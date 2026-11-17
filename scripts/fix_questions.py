#!/usr/bin/env python3
"""Audit fixes for the question bank.

Every entry in FIXES corrects a question whose prompt, reference SQL, notes or
sample output disagreed with each other. After patching a question we
regenerate `sample_output` and every test case's `expected_output` from the
(corrected) reference SQL, so the stored answers can never drift from the SQL.

Usage:  python3 scripts/fix_questions.py            # apply + regenerate fixed questions
        python3 scripts/fix_questions.py --regen-all  # regenerate every question's outputs
"""
from __future__ import annotations
import datetime, decimal, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
from engine.runner import SQLRunner  # noqa: E402

QDIR = os.path.join(ROOT, "questions")
RUNNER = SQLRunner()


def clean(v):
    if isinstance(v, decimal.Decimal):
        f = float(v)
        return int(f) if f == int(f) and abs(f) < 1e15 and "." not in str(v) else round(f, 6)
    if isinstance(v, float):
        return int(v) if v == int(v) and abs(v) < 1e15 else round(v, 6)
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d") if (v.hour, v.minute, v.second) == (0, 0, 0) else v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    return v


def run_rows(q, input_data, sql):
    res = RUNNER.execute(q["tables"], input_data, sql)
    if not res.success:
        raise RuntimeError(f"[{q['slug']}] SQL failed: {res.error}")
    return [{k: clean(v) for k, v in r.items()} for r in res.rows]


def regenerate(q):
    sql = q["reference_sql"]
    q["sample_output"] = run_rows(q, q["sample_data"], sql)
    for tc in q["test_cases"]:
        tc["expected_output"] = run_rows(q, tc["input_data"], sql)


def replace_q(q, old, new):
    if new in q["question"]:
        return  # already applied
    assert old in q["question"], f"{q['slug']}: text not found: {old[:40]}"
    q["question"] = q["question"].replace(old, new)


# ----------------------------------------------------------------------------
# Reference solutions & prompt corrections
# ----------------------------------------------------------------------------
FIXES = {}


def fix(slug, **kw):
    FIXES[slug] = kw


def weighted_median_sql(val, cnt, table):
    return f"""WITH r AS (
  SELECT {val}, {cnt},
         SUM({cnt}) OVER (ORDER BY {val} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum,
         SUM({cnt}) OVER () AS total
  FROM {table}
)
SELECT ROUND(AVG({val}), 1) AS median
FROM r
WHERE (FLOOR((total + 1) / 2) > cum - {cnt} AND FLOOR((total + 1) / 2) <= cum)
   OR (FLOOR(total / 2) + 1 > cum - {cnt} AND FLOOR(total / 2) + 1 <= cum);"""


fix("alibaba-compressed-median",
    reference_sql=weighted_median_sql("item_count", "order_occurrences", "items_per_order"),
    notes=["Expand the table mentally: 2 orders of 1 item and 3 orders of 4 items is [1, 1, 4, 4, 4]. The median is the middle value, 4.",
           "With an even number of orders the median is the average of the two middle values."])

fix("median-search-freq",
    reference_sql=weighted_median_sql("searches", "num_users", "search_frequency"),
    extra=lambda q: replace_q(q, "In the frequency table `search_category`", "In the frequency table `search_frequency`"))

fix("average-vacant-days",
    question="""Airbnb market managers analyze property utilization to help hosts optimize pricing.

A listing's **vacant days** in 2021 (a 365-day year) is `365 - days booked in 2021`. A booking occupies every night from `checkin_date` (inclusive) up to `checkout_date` (exclusive). Bookings can start before or end after 2021, so only nights that fall inside 2021 count. A listing's bookings never overlap each other.

Only active listings (`is_active = 1`) are considered, including active listings that have no bookings at all.

Write a query to calculate the average number of vacant days per active listing in 2021, rounded to 1 decimal place. Output it as `avg_vacant_days`.""",
    reference_sql="""WITH booked AS (
  SELECT listing_id,
         SUM(GREATEST(DATEDIFF(LEAST(checkout_date, CAST('2022-01-01' AS DATE)),
                               GREATEST(checkin_date, CAST('2021-01-01' AS DATE))), 0)) AS booked_days
  FROM bookings
  GROUP BY listing_id
)
SELECT ROUND(AVG(365 - IFNULL(b.booked_days, 0)), 1) AS avg_vacant_days
FROM listings l
LEFT JOIN booked b ON l.listing_id = b.listing_id
WHERE l.is_active = 1;""")

fix("best-selling-products",
    question="""Amazon retail category leaders need an automated weekly report identifying the top performing merchandise.

For each product category, find the top 2 best-selling products by **total sales quantity** (the sum of `sales_quantity` across all rows in `product_sales`). If total quantities are tied, break the tie by product name in ascending alphabetical order, so each category returns at most 2 products.

Output `category_name`, `product_name` and `total_quantity`, ordered by category name, then by total quantity (highest first), then by product name.""",
    reference_sql="""WITH totals AS (
  SELECT p.category_name, p.product_name, SUM(ps.sales_quantity) AS total_quantity
  FROM products p
  JOIN product_sales ps ON p.product_id = ps.product_id
  GROUP BY p.category_name, p.product_name
),
ranked AS (
  SELECT category_name, product_name, total_quantity,
         ROW_NUMBER() OVER (PARTITION BY category_name ORDER BY total_quantity DESC, product_name) AS rn
  FROM totals
)
SELECT category_name, product_name, total_quantity
FROM ranked
WHERE rn <= 2
ORDER BY category_name, total_quantity DESC, product_name;""")

fix("booking-referral-source", title="Substitute Rentals")

fix("click-through-rate",
    reference_sql="""SELECT
  app_id,
  ROUND(100.0 * SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 0), 2) AS ctr
FROM events
WHERE YEAR(timestamp) = 2022
GROUP BY app_id
ORDER BY ctr DESC, app_id ASC;""")

fix("compensation-outliers",
    question=None,
    extra=lambda q: (replace_q(q, "and whether they are classified as 'Overpaid' or 'Underpaid'.",
                               "and a `status` column that is either 'Overpaid' or 'Underpaid'. Sort by `employee_id`."),
                     q["tags"].append("medium") if "medium" not in q["tags"] else None))

fix("concurrent-user-sessions",
    question="""Platform reliability engineers need to monitor peak server demand by finding the maximum number of user sessions that were active at the exact same moment.

A session is active from its `start_time` up to, but not including, its `end_time`. A session that ends at the exact moment another one starts does **not** overlap with it.

Write a query to calculate the maximum number of concurrent sessions at any point in time. Output it as `max_concurrent_sessions`.""",
    reference_sql="""WITH events AS (
  SELECT start_time AS t, 1 AS delta FROM user_sessions
  UNION ALL
  SELECT end_time AS t, -1 AS delta FROM user_sessions
),
running AS (
  SELECT SUM(delta) OVER (ORDER BY t, delta ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS concurrent
  FROM events
)
SELECT MAX(concurrent) AS max_concurrent_sessions
FROM running;""")

fix("consulting-bench-time",
    question="""At Google Operations Consulting, resource managers track consultant 'bench time': the days in a calendar year that a consultant was not staffed on a billable client project.

`staffing` lists each employee and the jobs they are staffed on (`is_consultant` flags consultants). `consulting_engagements` holds each job's `start_date` and `end_date`, both **inclusive**.

Write a query to calculate every consultant's bench time for the year 2021:
• `bench_days = 365 - days worked on engagements in 2021` (engagements can start before or end after 2021, so only days inside 2021 count).
• A consultant's engagements never overlap, and consultants with no engagement at all have 365 bench days.
• Ignore employees who are not consultants.

Output `employee_id` and `bench_days`, sorted by `employee_id`.""",
    reference_sql="""SELECT
  s.employee_id,
  365 - IFNULL(SUM(GREATEST(DATEDIFF(LEAST(e.end_date, CAST('2021-12-31' AS DATE)),
                                      GREATEST(e.start_date, CAST('2021-01-01' AS DATE))) + 1, 0)), 0) AS bench_days
FROM staffing s
LEFT JOIN consulting_engagements e ON s.job_id = e.job_id
WHERE s.is_consultant = 1 OR s.is_consultant = 'true'
GROUP BY s.employee_id
ORDER BY s.employee_id;""")

fix("duplicate-job-listings",
    reference_sql="""WITH job_counts AS (
  SELECT company_id, title, description, COUNT(job_id) AS post_count
  FROM job_listings
  GROUP BY company_id, title, description
  HAVING COUNT(job_id) > 1
)
SELECT COUNT(DISTINCT company_id) AS co_w_dup_jobs
FROM job_counts;""")

EVENT_BASE = {
    "friendship_status": [
        {"user_a_id": 111, "user_b_id": 222, "status": "friends"},
        {"user_a_id": 222, "user_b_id": 111, "status": "friends"},
        {"user_a_id": 444, "user_b_id": 111, "status": "friends"},
        {"user_a_id": 111, "user_b_id": 444, "status": "friends"},
        {"user_a_id": 444, "user_b_id": 222, "status": "friends"},
        {"user_a_id": 222, "user_b_id": 444, "status": "friends"},
        {"user_a_id": 444, "user_b_id": 333, "status": "friends"},
        {"user_a_id": 333, "user_b_id": 444, "status": "friends"},
        {"user_a_id": 111, "user_b_id": 333, "status": "not_friends"},
        {"user_a_id": 333, "user_b_id": 111, "status": "not_friends"},
    ],
    "event_rsvp": [
        {"user_id": 111, "event_id": 789, "event_type": "public", "attendance_status": "going", "event_date": "07/15/2022"},
        {"user_id": 222, "event_id": 789, "event_type": "public", "attendance_status": "going", "event_date": "07/15/2022"},
        {"user_id": 111, "event_id": 234, "event_type": "private", "attendance_status": "going", "event_date": "07/18/2022"},
        {"user_id": 222, "event_id": 234, "event_type": "private", "attendance_status": "going", "event_date": "07/18/2022"},
        {"user_id": 333, "event_id": 234, "event_type": "private", "attendance_status": "going", "event_date": "07/18/2022"},
        {"user_id": 333, "event_id": 567, "event_type": "public", "attendance_status": "going", "event_date": "07/12/2022"},
        {"user_id": 444, "event_id": 567, "event_type": "public", "attendance_status": "maybe", "event_date": "07/12/2022"},
        {"user_id": 111, "event_id": 567, "event_type": "public", "attendance_status": "not_going", "event_date": "07/12/2022"},
    ],
}


def set_event_base(q):
    q["sample_data"] = json.loads(json.dumps(EVENT_BASE))
    q["test_cases"][0]["input_data"] = json.loads(json.dumps(EVENT_BASE))


fix("event-friends-rec",
    question="""Facebook's social recommendations team wants to recommend upcoming events to users based on what their friends are attending.

• `friendship_status` stores one row per direction with a `status` of `'friends'` or `'not_friends'`.
• In `event_rsvp`, a person is **registered** for an event when their `attendance_status` is `'going'` (`'maybe'` and `'not_going'` do not count).

Recommend an event to a user if **at least two of their friends** are registered for it and the user is not already registered for it themselves.

Write a query to output the `user_id` and the recommended `event_id`, sorted by `user_id` and then `event_id`.""",
    reference_sql="""WITH friends AS (
  SELECT user_a_id AS user_id, user_b_id AS friend_id FROM friendship_status WHERE status = 'friends'
  UNION
  SELECT user_b_id AS user_id, user_a_id AS friend_id FROM friendship_status WHERE status = 'friends'
),
going AS (
  SELECT user_id, event_id FROM event_rsvp WHERE attendance_status = 'going'
)
SELECT f.user_id, g.event_id
FROM friends f
JOIN going g ON g.user_id = f.friend_id
LEFT JOIN going me ON me.user_id = f.user_id AND me.event_id = g.event_id
WHERE me.user_id IS NULL
GROUP BY f.user_id, g.event_id
HAVING COUNT(DISTINCT f.friend_id) >= 2
ORDER BY f.user_id, g.event_id;""",
    notes=["Users 111, 222 and 333 are all friends of user 444.", "Friends 111 and 222 are going to event 789, so it is recommended to 444. Event 234 has three friends going, so it is recommended too."],
    extra=set_event_base)

fix("fill-missing-product",
    extra=lambda q: (replace_q(q, "Walmart supply chain inventory spreadsheets", "Accenture client inventory spreadsheets"),
                     replace_q(q, "`category_id`", "`category`")))

fix("final-account-balance",
    reference_sql="""SELECT
  account_id,
  SUM(CASE WHEN LOWER(transaction_type) = 'deposit' THEN amount
           WHEN LOWER(transaction_type) = 'withdrawal' THEN -amount
           ELSE 0 END) AS final_balance
FROM transactions
GROUP BY account_id
ORDER BY account_id;""",
    extra=lambda q: replace_q(q, "In the transactions ledger:", "In the transactions ledger (matching `transaction_type` is case-insensitive):"))

FMR_USERS = [
    {"user_id": 1, "signup_date": "06/01/2022 00:00:00"},
    {"user_id": 2, "signup_date": "06/02/2022 00:00:00"},
    {"user_id": 3, "signup_date": "06/08/2022 00:00:00"},
    {"user_id": 4, "signup_date": "07/03/2022 00:00:00"},
]
FMR_ACTIONS = [
    {"user_id": 1, "event_date": "06/10/2022 00:00:00", "action_type": "login"},
    {"user_id": 1, "event_date": "07/10/2022 00:00:00", "action_type": "login"},
    {"user_id": 2, "event_date": "07/15/2022 00:00:00", "action_type": "post"},
    {"user_id": 3, "event_date": "06/12/2022 00:00:00", "action_type": "login"},
    {"user_id": 3, "event_date": "07/20/2022 00:00:00", "action_type": "login"},
    {"user_id": 4, "event_date": "08/05/2022 00:00:00", "action_type": "login"},
]


def set_fmr_base(q):
    base = {"users": FMR_USERS, "user_actions": FMR_ACTIONS}
    q["sample_data"] = json.loads(json.dumps(base))
    q["test_cases"][0]["input_data"] = json.loads(json.dumps(base))


fix("first-month-retention",
    title="First Month Retention",
    question="""Mobile gaming product managers track player retention to see how many new players keep playing after their install month.

A player's **install month** is the calendar month of their `signup_date` in `users`. A player is **retained in month 1** if `user_actions` contains at least one `'login'` action for them during the calendar month immediately after their install month (other action types such as `'post'` do not count).

Write a query to calculate, for each install month, the percentage of players who were retained in month 1, rounded to 2 decimal places. Output `install_month` (formatted `'YYYY-MM'`) and `retention_pct`, sorted by `install_month`.""",
    reference_sql="""SELECT
  DATE_FORMAT(u.signup_date, '%Y-%m') AS install_month,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.user_id IS NOT NULL THEN u.user_id END)
        / COUNT(DISTINCT u.user_id), 2) AS retention_pct
FROM users u
LEFT JOIN user_actions a
  ON a.user_id = u.user_id
 AND a.action_type = 'login'
 AND DATE_FORMAT(a.event_date, '%Y-%m') = DATE_FORMAT(DATE_ADD(u.signup_date, INTERVAL 1 MONTH), '%Y-%m')
GROUP BY DATE_FORMAT(u.signup_date, '%Y-%m')
ORDER BY install_month;""",
    notes=["June cohort: users 1, 2 and 3 signed up. Users 1 and 3 logged in during July, user 2 only posted, so 2 of 3 = 66.67%.",
           "July cohort: user 4 logged in during August, so 100.00%."],
    extra=set_fmr_base)

fix("follow-up-airpod-percentage",
    reference_sql="""WITH iphone AS (
  SELECT customer_id, MIN(transaction_timestamp) AS first_iphone
  FROM transactions
  WHERE product_name = 'iPhone'
  GROUP BY customer_id
),
followed AS (
  SELECT DISTINCT i.customer_id
  FROM iphone i
  JOIN transactions t
    ON t.customer_id = i.customer_id
   AND t.product_name = 'AirPods'
   AND t.transaction_timestamp > i.first_iphone
)
SELECT ROUND(100.0 * (SELECT COUNT(*) FROM followed) / NULLIF((SELECT COUNT(*) FROM iphone), 0), 0) AS follow_up_percentage;""")

fix("frequently-purchased-pairs",
    reference_sql="""SELECT DISTINCT a.product_name AS product1, b.product_name AS product2
FROM products a
JOIN products b ON a.transaction_id = b.transaction_id AND a.product_name < b.product_name
ORDER BY product1, product2;""")

fix("invalid-search-pct",
    reference_sql="""SELECT
  ROUND(100.0 * SUM(CASE WHEN is_invalid = 1 OR num_results = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS invalid_search_pct
FROM search_category;""",
    extra=lambda q: replace_q(q, "Round the percentage to 2 decimal places.", "Round the percentage to 2 decimal places and output it as `invalid_search_pct`."))

fix("linkedin-power-creators-part2",
    reference_sql="""SELECT pp.profile_id
FROM personal_profiles pp
JOIN employee_company ec ON pp.profile_id = ec.personal_profile_id
JOIN company_pages cp ON ec.company_id = cp.company_id
GROUP BY pp.profile_id, pp.followers
HAVING pp.followers > MAX(cp.followers)
ORDER BY pp.profile_id ASC;""",
    notes=["A person can work at multiple companies.",
           "Their personal follower count must beat the follower count of every company they work for, not the total across all of them."])

fix("long-calls-growth",
    question="""UnitedHealth customer operations monitors call center volume growth over time.

A call is a **long call** if `call_duration_secs` is greater than 300 (5 minutes).

For every calendar month that has at least one call of any kind in `callers`, count the long calls and compute the month-over-month growth versus the previous month in the data:
• `growth_pct = 100 * (current - previous) / previous`, rounded to 1 decimal place.
• It is `NULL` for the first month, and whenever the previous month had zero long calls.

Output `call_month` (formatted `'YYYY-MM'`), `long_call_count` and `growth_pct`, ordered by `call_month`.""",
    reference_sql="""WITH monthly AS (
  SELECT DATE_FORMAT(call_date, '%Y-%m') AS call_month,
         SUM(CASE WHEN call_duration_secs > 300 THEN 1 ELSE 0 END) AS long_call_count
  FROM callers
  GROUP BY DATE_FORMAT(call_date, '%Y-%m')
)
SELECT call_month,
       long_call_count,
       ROUND(100.0 * (long_call_count - LAG(long_call_count) OVER (ORDER BY call_month))
             / NULLIF(LAG(long_call_count) OVER (ORDER BY call_month), 0), 1) AS growth_pct
FROM monthly
ORDER BY call_month;""",
    notes=["Months that have calls but no long calls count as 0 long calls.",
           "Growth is NULL for the first month, and whenever the previous month had 0 long calls (division by zero)."])

fix("marketing-touch-streak",
    question="""Snowflake enterprise marketing tracks prospective enterprise accounts through sequential touchpoints (emails, webinars, product demos).

A sales lead is **highly engaged** if they had a marketing touch in at least **three consecutive calendar weeks**. Weeks start on Monday, and several touches in the same week count as one week.

Write a query to return the email addresses of all highly engaged leads. Return unique emails sorted alphabetically.""",
    reference_sql="""WITH weeks AS (
  SELECT DISTINCT contact_id,
         FLOOR(DATEDIFF(event_date, CAST('1970-01-05' AS DATE)) / 7) AS wk
  FROM marketing_touches
),
islands AS (
  SELECT contact_id, wk,
         wk - ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY wk) AS grp
  FROM weeks
),
engaged AS (
  SELECT contact_id
  FROM islands
  GROUP BY contact_id, grp
  HAVING COUNT(*) >= 3
)
SELECT DISTINCT c.email
FROM crm_contacts c
JOIN engaged e ON e.contact_id = c.contact_id
ORDER BY c.email;""",
    notes=["Contact 1 had touches in the weeks of Apr 11, Apr 18 and Apr 25 (three consecutive weeks), so andy.markus@att.net qualifies.",
           "Contact 2 had all of their touches within the single week of Apr 18, so they do not qualify."])

fix("matching-rental-amenities",
    reference_sql="""SELECT a.rental_id AS rental_1, b.rental_id AS rental_2, COUNT(*) AS matching_amenities
FROM rental_amenities a
JOIN rental_amenities b ON a.amenity = b.amenity AND a.rental_id < b.rental_id
GROUP BY a.rental_id, b.rental_id
ORDER BY matching_amenities DESC, rental_1, rental_2;""")

fix("mean-median-mode",
    question="""Microsoft Outlook telemetry engineers analyze daily inbox statistics across enterprise accounts.

Given each user's daily incoming email count, write a query to compute three central tendency metrics in a single row:
• `mean`: the arithmetic average, rounded to the nearest integer.
• `median`: the middle value when sorted. With an even number of users, it is the average of the two middle values.
• `mode`: the most frequent email count. If several counts tie, return the smallest.""",
    reference_sql="""WITH ordered AS (
  SELECT email_count,
         ROW_NUMBER() OVER (ORDER BY email_count) AS rn,
         COUNT(*) OVER () AS cnt
  FROM inbox_stats
),
freq AS (
  SELECT email_count, COUNT(*) AS c FROM inbox_stats GROUP BY email_count
)
SELECT
  ROUND(AVG(email_count)) AS mean,
  (SELECT AVG(email_count) FROM ordered
    WHERE rn IN (FLOOR((cnt + 1) / 2), FLOOR(cnt / 2) + 1)) AS median,
  (SELECT MIN(email_count) FROM freq WHERE c = (SELECT MAX(c) FROM freq)) AS mode
FROM inbox_stats;""")

fix("money-transfer-relationships",
    reference_sql="""SELECT COUNT(*) AS relationships
FROM (SELECT DISTINCT payer_id, recipient_id FROM payments) p1
JOIN (SELECT DISTINCT payer_id, recipient_id FROM payments) p2
  ON p1.payer_id = p2.recipient_id AND p1.recipient_id = p2.payer_id
WHERE p1.payer_id < p1.recipient_id;""",
    notes=["A pair of users counts once, no matter how many payments went each way."])

fix("off-topic-maps-ugc",
    reference_sql="""WITH counts AS (
  SELECT p.place_category, COUNT(u.content_id) AS off_topic_count
  FROM place_info p
  JOIN maps_ugc_review u ON p.place_id = u.place_id
  WHERE LOWER(u.content_tag) = 'off-topic'
  GROUP BY p.place_category
)
SELECT place_category, off_topic_count
FROM counts
WHERE off_topic_count = (SELECT MAX(off_topic_count) FROM counts)
ORDER BY place_category;""",
    extra=lambda q: replace_q(q, "Output the `place_category` and the count of off-topic uploads, breaking ties by `place_category` in alphabetical order.",
                              "If several categories tie for the highest count, return all of them. Output `place_category` and the count of off-topic uploads as `off_topic_count`, sorted by `place_category`."))

fix("oracle-sales-quota",
    extra=lambda q: replace_q(q, "a quota status indicator:", "a quota status indicator named `made_quota`:"))

fix("patient-call-history",
    extra=lambda q: q.__setitem__("notes", ["Policy holder IDs 14 and 15 each made two calls within a 7-day interval. For example, ID 14 made calls on 02/17/2023 and 02/21/2023, and ID 15 on 01/08/2023 and 01/09/2023. Hence the count of unique callers is two."]))

fix("photoshop-revenue-analysis",
    question="""Adobe Creative Cloud financial analysts are studying the revenue that Photoshop customers generate from the rest of Adobe's product line.

Write a query to calculate, for every customer who has purchased **Photoshop**, their total revenue from all of their **other** Adobe products (exclude the Photoshop purchases themselves).

Output the `customer_id` and that total (`revenue`), sorted by `customer_id` in ascending order.""")

fix("quickbooks-vs-turbotax",
    reference_sql="""SELECT
  COUNT(DISTINCT CASE WHEN LOWER(product) LIKE '%quickbooks%' THEN user_id END) AS quickbooks_users,
  COUNT(DISTINCT CASE WHEN LOWER(product) LIKE '%turbotax%' THEN user_id END) AS turbotax_users
FROM filed_taxes;""")

fix("reactivated-users",
    question="""Facebook growth analytics tracks monthly user engagement transitions to measure reactivation after dormancy.

`user_logins` only contains data for the year 2022. Assume that every user was already active at some point before 2022.

A user is **reactivated** in month M (February to December) if they logged in during month M but had **no login at all** during month M - 1.

Write a query to count how many users were reactivated in each calendar month. Output `mth` (the month number) and `reactivated_users`, sorted by `mth`. Months with no reactivated users do not need to appear.""")

fix("repeated-payments",
    reference_sql="""WITH ordered_payments AS (
  SELECT merchant_id, credit_card_id, amount, transaction_timestamp,
         LAG(transaction_timestamp) OVER (
           PARTITION BY merchant_id, credit_card_id, amount
           ORDER BY transaction_timestamp
         ) AS prev_timestamp
  FROM transactions
)
SELECT COUNT(*) AS payment_count
FROM ordered_payments
WHERE prev_timestamp IS NOT NULL
  AND TIMESTAMPDIFF(SECOND, prev_timestamp, transaction_timestamp) <= 600;""")

fix("sales-team-compensation",
    question="""Oracle enterprise sales operations calculates annual compensation from each rep's contract.

Every rep earns their `base` salary. On deal volume **up to their quota** they earn the `commission` rate (for example `0.1` is 10%). Any deal volume **above the quota** earns an accelerated rate of `commission * accelerator` (for example `0.1 * 1.5 = 15%`).

`total_compensation = base + commission * min(total_deals, quota) + commission * accelerator * max(total_deals - quota, 0)`

Reps with no deals have a total deal volume of 0. Write a query to calculate each rep's total compensation, rounded to 2 decimal places. Output `employee_id` and `total_compensation`, sorted by `employee_id` in ascending order.""",
    reference_sql="""WITH deal_totals AS (
  SELECT employee_id, SUM(deal_size) AS total_deals
  FROM deals
  GROUP BY employee_id
)
SELECT
  c.employee_id,
  ROUND(c.base
        + c.commission * LEAST(IFNULL(d.total_deals, 0), c.quota)
        + c.commission * c.accelerator * GREATEST(IFNULL(d.total_deals, 0) - c.quota, 0), 2) AS total_compensation
FROM employee_contract c
LEFT JOIN deal_totals d ON c.employee_id = d.employee_id
ORDER BY c.employee_id;""",
    notes=["Employee 101 closed 800,000 against a 500,000 quota: 60,000 base + 10% of 500,000 + 15% of the 300,000 above quota = 155,000.",
           "Employee 102 stayed under quota: 50,000 base + 10% of 300,000 = 80,000."])

fix("second-day-confirmation",
    reference_sql="""SELECT DISTINCT e.user_id
FROM emails e
JOIN texts t ON e.email_id = t.email_id
WHERE t.signup_action = 'Confirmed'
  AND DATEDIFF(t.action_date, e.signup_date) = 1
  AND NOT EXISTS (
    SELECT 1 FROM texts t0
    WHERE t0.email_id = e.email_id
      AND t0.signup_action = 'Confirmed'
      AND DATEDIFF(t0.action_date, e.signup_date) = 0
  )
ORDER BY e.user_id;""")

SM_BASE = {"employees": [
    {"emp_id": 1, "manager_id": 101, "manager_name": "Duyen"},
    {"emp_id": 101, "manager_id": 1001, "manager_name": "Rick"},
    {"emp_id": 103, "manager_id": 1001, "manager_name": "Rick"},
    {"emp_id": 104, "manager_id": 1001, "manager_name": "Rick"},
    {"emp_id": 1001, "manager_id": 1008, "manager_name": "John"},
    {"emp_id": 1002, "manager_id": 1008, "manager_name": "John"},
]}


def set_sm_base(q):
    q["sample_data"] = json.loads(json.dumps(SM_BASE))
    q["test_cases"][0]["input_data"] = json.loads(json.dumps(SM_BASE))


fix("senior-managers-reportees",
    question="""Google People Analytics audits the organizational hierarchy to find managers who oversee larger teams.

Each row of `employees` is one employee (`emp_id`) together with the id and name of their direct manager (`manager_id`, `manager_name`).

A manager is a **Senior Manager** if they have **at least 3 direct reports**.

Write a query to output the `manager_name` and the number of direct reports (`direct_reports`) for every senior manager, ordered by `direct_reports` in descending order, then by `manager_name`.""",
    reference_sql="""SELECT manager_name, COUNT(DISTINCT emp_id) AS direct_reports
FROM employees
WHERE manager_id IS NOT NULL
GROUP BY manager_id, manager_name
HAVING COUNT(DISTINCT emp_id) >= 3
ORDER BY direct_reports DESC, manager_name;""",
    notes=["Rick (id 1001) manages employees 101, 103 and 104, so he has 3 direct reports. John has 2 and Duyen has 1, so neither is a senior manager."],
    extra=set_sm_base)

fix("signup-confirmation-rate",
    reference_sql="""SELECT ROUND(COUNT(DISTINCT t.email_id) / COUNT(DISTINCT e.email_id), 2) AS confirm_rate
FROM emails e
LEFT JOIN texts t ON e.email_id = t.email_id AND t.signup_action = 'Confirmed';""")

fix("snowflake-webinar-popularity",
    reference_sql="""SELECT
  ROUND(100.0 * SUM(CASE WHEN event_type = 'webinar' THEN 1 ELSE 0 END) / COUNT(*), 2) AS webinar_pct
FROM webinar_attendance;""")

fix("spotify-streaming-history",
    extra=lambda q: replace_q(q, "as of the latest tracking date.", "as of August 4, 2022 (inclusive). Weekly streams after that date must be ignored."))

fix("sql-average-deal-size-2",
    extra=lambda q: replace_q(q, "Write a query to calculate the average deal size in revenue for each tier.",
                              "Only deals with status `'Won'` count. Write a query to calculate the average deal size in revenue for each tier, ordered by `avg_deal_size` from highest to lowest (then by `tier`)."))

fix("sql-bad-experience",
    question="""DoorDash customer support tracks how new customers experience their first orders.

Consider only customers who **signed up in June 2022**, and only the orders they placed within **14 days of signing up** (day 0 to day 14 inclusive).

An order is a **bad experience** if its `status` is `'completed incorrectly'` or `'never_received'`.

Write a query to calculate the percentage of those orders that were a bad experience, rounded to 2 decimal places. Output it as `bad_experience_pct`.""",
    reference_sql="""SELECT
  ROUND(100.0 * SUM(CASE WHEN o.status IN ('completed incorrectly', 'never_received') THEN 1 ELSE 0 END)
        / COUNT(*), 2) AS bad_experience_pct
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE c.signup_timestamp >= '2022-06-01' AND c.signup_timestamp < '2022-07-01'
  AND DATEDIFF(o.order_timestamp, c.signup_timestamp) BETWEEN 0 AND 14;""")

fix("sql-bloomberg-stock-min-max-1",
    reference_sql="""WITH ranked AS (
  SELECT
    ticker,
    DATE_FORMAT(date, '%b-%Y') AS mth,
    open AS open_price,
    ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY open DESC, date ASC) AS rn_high,
    ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY open ASC, date ASC) AS rn_low
  FROM stock_prices
)
SELECT
  h.ticker,
  h.mth AS highest_mth,
  h.open_price AS highest_open,
  l.mth AS lowest_mth,
  l.open_price AS lowest_open
FROM (SELECT ticker, mth, open_price FROM ranked WHERE rn_high = 1) h
JOIN (SELECT ticker, mth, open_price FROM ranked WHERE rn_low = 1) l ON h.ticker = l.ticker
ORDER BY h.ticker;""")

fix("sql-bloomberg-stock-monthly-change",
    question=None,
    reference_sql="""WITH monthly AS (
  SELECT
    ticker,
    DATE_FORMAT(date, '%Y-%m') AS ym,
    close,
    ROW_NUMBER() OVER (PARTITION BY ticker, DATE_FORMAT(date, '%Y-%m') ORDER BY date DESC) AS rn
  FROM stock_prices
),
eom AS (
  SELECT ticker, ym, close FROM monthly WHERE rn = 1
)
SELECT
  ticker,
  ym AS month,
  close AS month_close,
  ROUND(close - LAG(close) OVER (PARTITION BY ticker ORDER BY ym), 2) AS change_vs_prev_month
FROM eom
ORDER BY ticker, month;""",
    extra=lambda q: replace_q(q, "Write a query to output the `ticker`, year-month (`'YYYY-MM'`), the current month close, and the price difference from the previous month. Order by `ticker` and date.",
                              "Use each month's last recorded closing price. Output `ticker`, `month` (formatted `'YYYY-MM'`), `month_close` and `change_vs_prev_month` (NULL for a ticker's first month), ordered by `ticker` and `month`."))

fix("sql-bloomberg-underperforming-stocks",
    question="""Bloomberg equity research algorithms flag stocks that lag behind the rest of the portfolio.

For each calendar month, compare every ticker's **average closing price** to the **portfolio average closing price**, which is the average closing price across all rows of all tickers in that month. A ticker **underperforms** in a month if its average is strictly lower than the portfolio average.

Write a query that lists every underperforming ticker-month. Output `issue_month` (formatted `'MM/YYYY'`), `ticker`, `ticker_avg_close` and `portfolio_avg_close` (both rounded to 2 decimal places), ordered chronologically by month and then by `ticker`.""")

fix("sql-first-transaction",
    reference_sql="""WITH first_orders AS (
  SELECT user_id, spend,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY transaction_date) AS rn
  FROM user_transactions
)
SELECT COUNT(user_id) AS users_count
FROM first_orders
WHERE rn = 1 AND spend >= 50;""")

fix("sql-highest-grossing",
    extra=lambda q: replace_q(q, "Output the top 2 products per category ranked by total spend in descending order.",
                              "Products tied on total spend share a rank, so a tie for second place returns every tied product. Order by `category`, then by total spend (highest first)."))

fix("sql-highest-products",
    question="""eBay marketplace trust and safety engineers monitor high-volume sellers to prevent commercial catalog flooding.

Only users whose **total spend is at least $1,000** are considered. Among them, find the top 3 users with the highest number of **unique products** (`COUNT(DISTINCT product_id)`). Break ties by higher total spend, then by lower `user_id`.

Output `user_id` and the unique product count (`num_products`), ordered by `num_products` in descending order.""",
    reference_sql="""SELECT user_id, COUNT(DISTINCT product_id) AS num_products
FROM user_transactions
GROUP BY user_id
HAVING SUM(spend) >= 1000
ORDER BY num_products DESC, SUM(spend) DESC, user_id ASC
LIMIT 3;""")

def set_ibm_base(q):
    extra_emps = [{"employee_id": str(i), "full_name": n, "gender": g} for i, n, g in
                  [(110, "Mara Quint", "Female"), (132, "Oren Vale", "Male"), (221, "Tess Holloway", "Female"),
                   (226, "Dev Anand", "Male"), (240, "Ines Calder", "Female")]]
    extra_q = {"employee_id": "226", "query_id": "856990", "query_starttime": "07/03/2023 09:12:00", "execution_time": "310"}
    for target in (q["sample_data"], q["test_cases"][0]["input_data"]):
        existing = {e["employee_id"] for e in target["employees"]}
        target["employees"] += [e for e in extra_emps if e["employee_id"] not in existing]
        if extra_q not in target["queries"]:
            target["queries"].append(dict(extra_q))


fix("sql-ibm-db2-product-analytics",
    notes=["The query log covers Q3 2023 (July 1 to September 30).",
           "Employees 110, 132, 221 and 240 each ran one unique query and employee 226 ran two. Employees 1, 2 and 3 ran none, so the buckets are 0, 1 and 2 queries."],
    extra=set_ibm_base)

fix("sql-monthly-merchant-balance",
    reference_sql="""SELECT
  DATE_FORMAT(transaction_date, '%Y-%m') AS transaction_month,
  SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) AS balance
FROM transactions
GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
ORDER BY transaction_month;""",
    extra=lambda q: replace_q(q, "Output the year-month (`'YYYY-MM'`) and the total net balance, ordered by month.",
                              "Output `transaction_month` (formatted `'YYYY-MM'`) and `balance` (deposits minus withdrawals), ordered by month."))

fix("sql-purchasing-activity",
    reference_sql="""SELECT
  order_date,
  product_type,
  ROUND(SUM(SUM(spend)) OVER (PARTITION BY product_type ORDER BY order_date), 2) AS cum_spend
FROM purchases
GROUP BY order_date, product_type
ORDER BY product_type, order_date;""",
    extra=lambda q: replace_q(q, "For each order date, compute", "For each category and order date (several orders on the same date are combined into one row), compute"))

fix("sql-top-businesses",
    question="""Yelp business quality algorithms identify top-rated local establishments that consistently earn positive reviews.

A business is **top-rated** if its lowest review rating is 4 stars or higher (`MIN(review_stars) >= 4`), meaning every customer review gave at least 4 stars.

Write a query to count the top-rated businesses and their share of all reviewed businesses. Output `top_rated_businesses` and `top_rated_pct` (rounded to 2 decimal places).""",
    reference_sql="""WITH biz AS (
  SELECT business_id, MIN(review_stars) AS worst_review
  FROM reviews
  GROUP BY business_id
)
SELECT
  SUM(CASE WHEN worst_review >= 4 THEN 1 ELSE 0 END) AS top_rated_businesses,
  ROUND(100.0 * SUM(CASE WHEN worst_review >= 4 THEN 1 ELSE 0 END) / COUNT(*), 2) AS top_rated_pct
FROM biz;""")

fix("sql-well-paid-employees",
    extra=lambda q: replace_q(q, "Output the `employee_id` and employee `name`", "Output `employee_id` and `employee_name`"))

fix("subject-matter-experts",
    reference_sql="""SELECT employee_id
FROM employee_expertise
GROUP BY employee_id
HAVING MAX(years_of_experience) >= 8
    OR COUNT(DISTINCT CASE WHEN years_of_experience >= 5 THEN domain END) >= 2
ORDER BY employee_id;""")

fix("top-drugs-sold",
    question="""CVS Health pharmacy inventory managers want to identify the top 3 best-selling medications produced by each pharmaceutical manufacturer.

Rank the medications within each manufacturer by `units_sold` in descending order. Break ties alphabetically by `drug` so every rank is unique (1, 2, 3).

Write a query to output `manufacturer`, `drug` and `sales_rank` for the top 3 drugs of each manufacturer, ordered by `manufacturer` and `sales_rank`.""",
    reference_sql="""WITH ranked AS (
  SELECT manufacturer, drug,
         ROW_NUMBER() OVER (PARTITION BY manufacturer ORDER BY units_sold DESC, drug ASC) AS sales_rank
  FROM pharmacy_sales
)
SELECT manufacturer, drug, sales_rank
FROM ranked
WHERE sales_rank <= 3
ORDER BY manufacturer, sales_rank;""")

fix("total-drugs-sales",
    reference_sql="""SELECT
  manufacturer,
  CONCAT('$', CAST(ROUND(SUM(total_sales) / 1000000, 0) AS SIGNED), ' million') AS sales_mil
FROM pharmacy_sales
GROUP BY manufacturer
ORDER BY SUM(total_sales) DESC, manufacturer;""",
    notes=["Biogen: $2,041,758.41 + $500,101.61 + $1,084,258.00 = $3,626,118.02, which rounds to $4 million.",
           "Eli Lilly: $293,452.54 rounds to $0 million."])

fix("uncategorized-calls-percentage",
    reference_sql="""SELECT
  ROUND(100.0 * SUM(CASE WHEN call_category IS NULL OR LOWER(call_category) = 'n/a' THEN 1 ELSE 0 END) / COUNT(*), 1) AS call_percentage
FROM callers;""")

fix("uniquely-staffed-consultants",
    question="""Accenture client staffing managers want to know how much of each client's team is dedicated to that client alone.

A consultant is **exclusive** to a client if every engagement they have been staffed on belongs to that one client. A consultant can work on several engagements for the same client and still be exclusive.

For each client, count the distinct consultants staffed on any of its engagements (`total_staffed`) and how many of them are exclusive to that client (`exclusive_staffed`).

Output `client_name`, `total_staffed` and `exclusive_staffed`, sorted by `client_name`.""",
    reference_sql="""WITH emp_client AS (
  SELECT s.employee_id, e.client_name
  FROM staffing s
  JOIN engagements e ON s.engagement_id = e.engagement_id
  GROUP BY s.employee_id, e.client_name
),
client_counts AS (
  SELECT employee_id, COUNT(*) AS num_clients
  FROM emp_client
  GROUP BY employee_id
)
SELECT
  ec.client_name,
  COUNT(*) AS total_staffed,
  SUM(CASE WHEN cc.num_clients = 1 THEN 1 ELSE 0 END) AS exclusive_staffed
FROM emp_client ec
JOIN client_counts cc ON ec.employee_id = cc.employee_id
GROUP BY ec.client_name
ORDER BY ec.client_name;""",
    notes=["Employee 1001 worked for two clients, so they count toward both clients' totals but are exclusive to neither.",
           "Both Google consultants only worked for Google, so Google has 2 total and 2 exclusive."])

fix("updated-status",
    question="""Meta advertiser billing operations tracks how advertisers' payment status changes day to day.

`advertiser` holds each known advertiser's current `status` (`'NEW'`, `'EXISTING'`, `'CHURN'` or `'RESURRECT'`). `daily_pay` has one row for every advertiser that paid today, including advertisers not yet in `advertiser`. The statuses update as follows:

• Advertiser **not** in `advertiser` who paid today → `'NEW'`.
• Known advertiser who paid today → `'EXISTING'`, or `'RESURRECT'` if their current status is `'CHURN'`.
• Known advertiser who did **not** pay today → `'CHURN'`.

Write a query to output each advertiser's `user_id` and updated status (`new_status`), ordered by `user_id`.""",
    reference_sql="""SELECT a.user_id,
       CASE WHEN d.user_id IS NULL THEN 'CHURN'
            WHEN a.status = 'CHURN' THEN 'RESURRECT'
            ELSE 'EXISTING' END AS new_status
FROM advertiser a
LEFT JOIN daily_pay d ON a.user_id = d.user_id
UNION ALL
SELECT d.user_id, 'NEW' AS new_status
FROM daily_pay d
LEFT JOIN advertiser a ON a.user_id = d.user_id
WHERE a.user_id IS NULL
ORDER BY user_id;""")

fix("user-retention",
    reference_sql="""WITH monthly_users AS (
  SELECT DISTINCT user_id, MONTH(event_date) AS mth
  FROM user_actions
  WHERE event_type IN ('sign-in', 'like', 'comment')
    AND YEAR(event_date) = 2022
)
SELECT curr.mth AS mth, COUNT(DISTINCT curr.user_id) AS monthly_active_users
FROM monthly_users curr
JOIN monthly_users prev ON curr.user_id = prev.user_id AND curr.mth = prev.mth + 1
WHERE curr.mth = 7
GROUP BY curr.mth;""")

fix("user-session-activity",
    extra=lambda q: replace_q(q, "Write a query to rank users within each session type based on their total session duration in descending order.",
                              "Only sessions that started in January 2020 count. Write a query to rank users within each session type by their total session duration in descending order, using `RANK()` so tied users share a rank."))

def retype_columns(q, table, col, new_type):
    for t in q["tables"]:
        if t["table_name"] == table:
            for c in t["columns"]:
                if c["column_name"] == col:
                    c["data_type"] = new_type


fix("international-call-percentage",
    extra=lambda q: (retype_columns(q, "phone_info", "country_id", "VARCHAR(255)"),
                     retype_columns(q, "phone_info", "network", "VARCHAR(255)")))

fix("alibaba-compressed-mean",
    notes=["The table holds 500 orders with one item, 1000 with two items, 800 with three items and 1000 with four items.",
           "Total items = (1*500) + (2*1000) + (3*800) + (4*1000) = 8900",
           "Total orders = 500 + 1000 + 800 + 1000 = 3300",
           "Mean = 8900 / 3300 = 2.7"])

fix("odd-even-measurements",
    extra=lambda q: q.__setitem__("notes", [n for n in q["notes"] if n != "Based on the results,"]))

fix("sql-swapped-food-delivery",
    extra=lambda q: q.__setitem__("notes", [n for n in q["notes"] if not n.startswith(("Here's a sample", "The corrected data"))]))

fix("top-profitable-drugs",
    extra=lambda q: q.__setitem__("notes", [n.replace("$79,815.3)", "$79,815.03)") for n in q["notes"]]))

fix("updated-status",
    notes=["'bing' is a known advertiser with no payment in `daily_pay`, so it becomes CHURN.",
           "'yahoo' and 'alibaba' are known advertisers who paid, so they stay EXISTING (a CHURN advertiser who pays again becomes RESURRECT).",
           "'target' paid but is not yet in `advertiser`, so it is NEW."],
    **{k: v for k, v in dict(
        question=None).items() if v is not None})

fix("user-retention",
    notes=["An active user performed a sign-in, like or comment. A user is retained in July when they were active in both June and July.",
           "In the sample data, two users were active in both months."])

fix("yoy-growth-rate",
    notes=["Product 123424 has spend in 2019, 2020, 2021 and 2022. 2019 has no prior year, so its prev_year_spend and yoy_rate are NULL.",
           "2020 spend was 1000.20 against 1500.60 the year before, a change of -33.35%. 2021 was 1246.44 against 1000.20, a growth of 24.62%.",
           "yoy_rate = 100 * (current - previous) / previous."],
    extra=lambda q: (replace_q(q, "Amazon retail financial analysts", "Wayfair retail financial analysts"),
                     replace_q(q, "Write a query to calculate the Year-over-Year growth rate for each product by calendar year.",
                               "Write a query to calculate the Year-over-Year growth rate for each product by calendar year. If a product has no spend in the immediately preceding calendar year, `prev_year_spend` and `yoy_rate` are NULL.")))

fix("prime-warehouse-storage",
    extra=lambda q: (q.__setitem__("reference_sql", q["reference_sql"].replace("total_items", "item_count")),
                     replace_q(q, "Write a query to calculate the maximum number of Prime batches and non-Prime batches that can be stocked in the warehouse.",
                               "Write a query to calculate the maximum number of items of each type (`item_type` is `'prime_eligible'` or `'not_prime'`) that can be stocked. Output `item_type` and `item_count`, where `item_count` is the total number of items across all the batches stocked.")))



def main():
    regen_all = "--regen-all" in sys.argv
    files = sorted(f for f in os.listdir(QDIR) if f.endswith(".json"))
    touched = 0
    for fn in files:
        path = os.path.join(QDIR, fn)
        q = json.load(open(path, encoding="utf-8"))
        slug = q["slug"]
        spec = FIXES.get(slug)
        if spec is None and not regen_all:
            continue
        if spec:
            for key in ("title", "reference_sql", "notes"):
                if spec.get(key) is not None:
                    q[key] = spec[key]
            if spec.get("question"):
                q["question"] = spec["question"]
            if spec.get("extra"):
                spec["extra"](q)
        regenerate(q)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=2, ensure_ascii=False)
            f.write("\n")
        touched += 1
        print(f"patched {slug}")
    unknown = set(FIXES) - {json.load(open(os.path.join(QDIR, f)))["slug"] for f in files}
    if unknown:
        print("UNKNOWN SLUGS:", unknown)
    print(f"{touched} questions rewritten")


if __name__ == "__main__":
    main()

-- Large BigQuery-style pipeline for lineage / overview-mode testing.
-- Exercises: recursive CTE, UNION ALL, LATERAL, subqueries, multi-join chains,
-- window functions, CASE, ROLLUP, HAVING, QUALIFY, JSON aggregation.
-- Target: 40+ graph nodes (triggers table overview default in UI).

WITH RecursiveOrgHierarchy AS (
    SELECT
        o.org_id,
        o.org_name,
        o.parent_org_id,
        CAST(o.org_name AS STRING) AS org_path,
        1 AS depth
    FROM organizations o
    WHERE o.parent_org_id IS NULL

    UNION ALL

    SELECT
        c.org_id,
        c.org_name,
        c.parent_org_id,
        CONCAT(h.org_path, ' > ', c.org_name),
        h.depth + 1
    FROM organizations c
    INNER JOIN RecursiveOrgHierarchy h ON c.parent_org_id = h.org_id
),
RegionalStorePerformance AS (
    SELECT
        r.region_code,
        r.region_name,
        s.store_id,
        s.store_name,
        SUM(sa.gross_amount) AS store_revenue,
        COUNT(DISTINCT sa.transaction_id) AS transaction_count
    FROM regions r
    INNER JOIN stores s ON s.region_code = r.region_code
    INNER JOIN store_sales sa ON sa.store_id = s.store_id
    WHERE sa.sale_date >= DATE '2024-01-01'
    GROUP BY r.region_code, r.region_name, s.store_id, s.store_name
),
ProductMarginSnapshot AS (
    SELECT
        p.product_id,
        p.product_name,
        c.category_name,
        p.list_price,
        COALESCE(cost.unit_cost, 0) AS unit_cost,
        p.list_price - COALESCE(cost.unit_cost, 0) AS unit_margin
    FROM products p
    INNER JOIN product_categories c ON p.category_id = c.category_id
    LEFT JOIN (
        SELECT
            product_id,
            AVG(unit_cost) AS unit_cost
        FROM product_cost_history
        WHERE effective_date >= DATE '2023-01-01'
        GROUP BY product_id
    ) cost ON cost.product_id = p.product_id
),
UnionedOrderChannels AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.order_date,
        'ONLINE' AS channel,
        o.total_amount
    FROM online_orders o
    WHERE o.status = 'COMPLETED'

    UNION ALL

    SELECT
        r.order_id,
        r.customer_id,
        r.order_date,
        'RETAIL' AS channel,
        r.total_amount
    FROM retail_orders r
    WHERE r.is_finalized = TRUE
),
LatestCustomerTier AS (
    SELECT
        cu.customer_id,
        cu.customer_name,
        cu.region_code,
        tier.tier_code,
        tier.discount_pct
    FROM customers cu
    LEFT LATERAL (
        SELECT t.tier_code, t.discount_pct
        FROM customer_tier_history t
        WHERE t.customer_id = cu.customer_id
          AND t.effective_date <= CURRENT_DATE()
        ORDER BY t.effective_date DESC
        LIMIT 1
    ) tier ON TRUE
),
EmployeeUtilization AS (
    SELECT
        e.employee_id,
        e.department_id,
        SUM(ts.hours_logged) AS total_hours,
        AVG(ts.utilization_pct) AS avg_utilization,
        ROW_NUMBER() OVER (
            PARTITION BY e.department_id
            ORDER BY SUM(ts.hours_logged) DESC
        ) AS hours_rank_in_dept
    FROM employees e
    INNER JOIN timesheets ts ON ts.employee_id = e.employee_id
    WHERE ts.week_start_date >= DATE '2024-01-01'
    GROUP BY e.employee_id, e.department_id
),
SupplierQualityScores AS (
    SELECT
        sup.supplier_id,
        sup.supplier_name,
        AVG(ins.quality_score) AS avg_quality,
        COUNT(ins.inspection_id) AS inspection_count
    FROM suppliers sup
    INNER JOIN supplier_inspections ins ON ins.supplier_id = sup.supplier_id
    GROUP BY sup.supplier_id, sup.supplier_name
),
WarehouseStockLevels AS (
    SELECT
        w.warehouse_id,
        w.warehouse_name,
        inv.product_id,
        SUM(inv.quantity_on_hand) AS qty_on_hand,
        SUM(inv.quantity_reserved) AS qty_reserved
    FROM warehouses w
    INNER JOIN inventory inv ON inv.warehouse_id = w.warehouse_id
    GROUP BY w.warehouse_id, w.warehouse_name, inv.product_id
),
ShipmentLagMetrics AS (
    SELECT
        sh.shipment_id,
        sh.order_id,
        sh.ship_date,
        sh.delivery_date,
        LAG(sh.delivery_date) OVER (
            PARTITION BY sh.warehouse_id
            ORDER BY sh.ship_date
        ) AS prev_delivery_date,
        DATE_DIFF(sh.delivery_date, sh.ship_date, DAY) AS transit_days
    FROM shipments sh
    WHERE sh.ship_date >= DATE '2024-01-01'
),
OrderChannelRollup AS (
    SELECT
        uoc.channel,
        uoc.customer_id,
        COUNT(*) AS order_count,
        SUM(uoc.total_amount) AS channel_revenue
    FROM UnionedOrderChannels uoc
    GROUP BY uoc.channel, uoc.customer_id
),
CustomerSegmentation AS (
    SELECT
        lct.customer_id,
        lct.customer_name,
        lct.region_code,
        lct.tier_code,
        ocr.channel,
        ocr.order_count,
        ocr.channel_revenue,
        CASE
            WHEN ocr.channel_revenue >= 100000 THEN 'WHALE'
            WHEN ocr.channel_revenue >= 25000 THEN 'GROWTH'
            WHEN ocr.channel_revenue > 0 THEN 'STANDARD'
            ELSE 'INACTIVE'
        END AS revenue_segment
    FROM LatestCustomerTier lct
    LEFT JOIN OrderChannelRollup ocr ON ocr.customer_id = lct.customer_id
),
DepartmentCompensationBands AS (
    SELECT
        d.department_id,
        d.department_name,
        AVG(pay.total_compensation) AS avg_comp,
        PERCENTILE_CONT(pay.total_compensation, 0.9) OVER (
            PARTITION BY d.department_id
        ) AS p90_comp
    FROM departments d
    INNER JOIN (
        SELECT
            e.employee_id,
            e.department_id,
            s.base_salary + COALESCE(b.bonus_amount, 0) AS total_compensation
        FROM employees e
        INNER JOIN salaries s ON s.employee_id = e.employee_id
        LEFT JOIN bonuses b ON b.employee_id = e.employee_id
    ) pay ON pay.department_id = d.department_id
    GROUP BY d.department_id, d.department_name, pay.total_compensation
),
ProjectProfitability AS (
    SELECT
        pr.project_id,
        pr.project_name,
        pr.client_id,
        SUM(pp.billable_hours * pp.bill_rate) AS project_revenue,
        SUM(pp.billable_hours * pp.cost_rate) AS project_cost
    FROM projects pr
    INNER JOIN project_billing pp ON pp.project_id = pr.project_id
    WHERE pr.status IN ('ACTIVE', 'CLOSING')
    GROUP BY pr.project_id, pr.project_name, pr.client_id
)
SELECT
    roh.org_path,
    rsp.region_name,
    cs.revenue_segment,
    cs.channel,
    COUNT(DISTINCT cs.customer_id) AS customer_count,
    SUM(cs.channel_revenue) AS total_channel_revenue,
    ROUND(AVG(pms.unit_margin), 2) AS avg_product_margin,
    SUM(wsl.qty_on_hand) AS total_inventory_units,
    MAX(eu.avg_utilization) AS peak_utilization,
    JSON_OBJECT(
        'top_supplier', MAX(sqs.supplier_name),
        'avg_quality', ROUND(AVG(sqs.avg_quality), 2)
    ) AS supplier_snapshot
FROM RecursiveOrgHierarchy roh
INNER JOIN RegionalStorePerformance rsp
    ON rsp.region_code = SUBSTR(roh.org_path, 1, 2)
INNER JOIN CustomerSegmentation cs
    ON cs.region_code = rsp.region_code
INNER JOIN ProductMarginSnapshot pms
    ON pms.unit_margin > 0
INNER JOIN WarehouseStockLevels wsl
    ON wsl.product_id = pms.product_id
INNER JOIN EmployeeUtilization eu
    ON eu.hours_rank_in_dept <= 5
INNER JOIN SupplierQualityScores sqs
    ON sqs.avg_quality >= 3.5
INNER JOIN ShipmentLagMetrics slm
    ON slm.transit_days <= 7
INNER JOIN DepartmentCompensationBands dcb
    ON dcb.avg_comp > 50000
INNER JOIN ProjectProfitability pp
    ON pp.project_revenue > pp.project_cost
WHERE cs.revenue_segment IN ('WHALE', 'GROWTH', 'STANDARD')
  AND rsp.store_revenue > 10000
GROUP BY ROLLUP (
    roh.org_path,
    rsp.region_name,
    cs.revenue_segment,
    cs.channel
)
HAVING COUNT(DISTINCT cs.customer_id) >= 3
   AND SUM(cs.channel_revenue) > 5000
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY rsp.region_name, cs.revenue_segment
    ORDER BY SUM(cs.channel_revenue) DESC
) <= 15
ORDER BY
    total_channel_revenue DESC,
    customer_count DESC;

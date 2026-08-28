WITH RecursiveDepartmentHierarchy AS (
    -- Anchor member: Select top-level departments
    SELECT 
        d.department_id,
        d.department_name,
        d.parent_department_id,
        CAST(d.department_name AS VARCHAR(1000)) AS department_path,
        1 AS depth
    FROM departments d
    WHERE d.parent_department_id IS NULL

    UNION ALL

    -- Recursive member: Select child departments
    SELECT 
        d.department_id,
        d.department_name,
        d.parent_department_id,
        CAST(CONCAT(dh.department_path, ' > ', d.department_name) AS VARCHAR(1000)),
        dh.depth + 1
    FROM departments d
    INNER JOIN RecursiveDepartmentHierarchy dh ON d.parent_department_id = dh.department_id
),
EmployeeCompensationMetrics AS (
    SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        e.department_id,
        e.hire_date,
        COALESCE(sal.base_salary, 0) AS base_salary,
        COALESCE(bon.bonus_amount, 0) AS bonus_amount,
        COALESCE(sal.base_salary, 0) + COALESCE(bon.bonus_amount, 0) AS total_compensation,
        ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY (COALESCE(sal.base_salary, 0) + COALESCE(bon.bonus_amount, 0)) DESC) as comp_rank_in_dept,
        PERCENT_RANK() OVER (ORDER BY COALESCE(sal.base_salary, 0) + COALESCE(bon.bonus_amount, 0) ASC) as global_comp_percentile
    FROM employees e
    LEFT LATERAL (
        SELECT base_salary 
        FROM salaries s 
        WHERE s.employee_id = e.employee_id 
          AND s.effective_date <= CURRENT_DATE 
        ORDER BY s.effective_date DESC 
        LIMIT 1
    ) sal ON TRUE
    LEFT JOIN (
        SELECT employee_id, SUM(amount) AS bonus_amount
        FROM bonuses
        WHERE EXTRACT(YEAR FROM award_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1
        GROUP BY employee_id
    ) bon ON e.employee_id = bon.employee_id
    WHERE e.status = 'ACTIVE'
),
AggregatedProjectAnalytics AS (
    SELECT 
        p.project_id,
        p.project_name,
        p.client_id,
        COUNT(DISTINCT pa.employee_id) AS total_assigned_employees,
        SUM(ts.hours_worked) AS total_hours_logged,
        AVG(ts.hourly_rate) AS average_hourly_rate,
        SUM(ts.hours_worked * ts.hourly_rate) AS total_project_labor_cost
    FROM projects p
    INNER JOIN project_assignments pa ON p.project_id = pa.project_id
    INNER JOIN time_sheets ts ON pa.employee_id = ts.employee_id AND pa.project_id = ts.project_id
    WHERE p.start_date >= '2024-01-01'
    GROUP BY p.project_id, p.project_name, p.client_id
),
ClientTierClassification AS (
    SELECT 
        c.client_id,
        c.client_name,
        c.region_code,
        SUM(apa.total_project_labor_cost) AS total_revenue,
        CASE 
        WHEN SUM(apa.total_project_labor_cost) >= 1000000 THEN 'Enterprise'
        WHEN SUM(apa.total_project_labor_cost) BETWEEN 250000 AND 999999 THEN 'Mid-Market'
        ELSE 'SMB'
        END AS client_tier
    FROM clients c
    INNER JOIN AggregatedProjectAnalytics apa ON c.client_id = apa.client_id
    GROUP BY c.client_id, c.client_name, c.region_code
)
SELECT 
    dh.department_path,
    ct.client_tier,
    ct.region_code,
    COUNT(DISTINCT ecm.employee_id) AS active_employee_count,
    ROUND(AVG(ecm.total_compensation), 2) AS average_total_compensation,
    MAX(ecm.total_compensation) AS max_total_compensation,
    MIN(ecm.total_compensation) AS min_total_compensation,
    SUM(apa.total_project_labor_cost) AS aggregate_labor_cost,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'employee_name', CONCAT(ecm.first_name, ' ', ecm.last_name),
            'compensation', ecm.total_compensation,
            'percentile', ecm.global_comp_percentile
        )
    ) FILTER (WHERE ecm.comp_rank_in_dept <= 3) AS top_earners_json
FROM RecursiveDepartmentHierarchy dh
INNER JOIN EmployeeCompensationMetrics ecm ON dh.department_id = ecm.department_id
INNER JOIN project_assignments pa ON ecm.employee_id = pa.employee_id
INNER JOIN AggregatedProjectAnalytics apa ON pa.project_id = apa.project_id
INNER JOIN ClientTierClassification ct ON apa.client_id = ct.client_id
WHERE ecm.global_comp_percentile >= 0.05
  AND ct.region_code IN ('NA', 'EMEA', 'APAC')
GROUP BY ROLLUP (
    dh.department_path,
    ct.client_tier,
    ct.region_code
)
HAVING COUNT(DISTINCT ecm.employee_id) >= 2
   AND AVG(ecm.total_compensation) > 50000
QUALIFY ROW_NUMBER() OVER (PARTITION BY ct.client_tier ORDER BY AVG(ecm.total_compensation) DESC) <= 10
ORDER BY 
    active_employee_count DESC, 
    average_total_compensation DESC;
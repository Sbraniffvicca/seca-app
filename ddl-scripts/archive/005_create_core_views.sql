CREATE VIEW profile_vw AS
SELECT 
    cp.customer_id,
    pt.profile_id,
    pt.profile_type,
    tt.terrain_type,
    st.skill_type,
    cp.created_dttm,
    cp.updated_dttm
FROM 
    cust_profiles cp
JOIN 
    profile_types pt ON cp.profile_id = pt.profile_id
JOIN 
    terrain_types tt ON pt.terrain_type_id = tt.terrain_type_id
JOIN 
    skill_types st ON pt.skill_type_id = st.skill_type_id;



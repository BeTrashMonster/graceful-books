-- Remove test workshop enrollments for Audrey
-- This allows retesting the signup flow

-- First, check what exists
SELECT
  u.email,
  u.id as user_id,
  we.id as enrollment_id,
  w.workshop_name,
  we.enrolled_at
FROM users u
LEFT JOIN workshop_enrollments we ON we.user_id = u.id
LEFT JOIN workshops w ON w.id = we.workshop_id
WHERE u.email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com');

-- Delete workshop enrollments
DELETE FROM workshop_enrollments
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
);

-- Delete charity selections
DELETE FROM user_charity_selections
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
);

-- Optionally delete the user accounts entirely (if they were just for testing)
-- Uncomment the line below if you want to fully delete the test accounts
-- DELETE FROM users WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com');

-- Verify deletion
SELECT
  u.email,
  COUNT(we.id) as enrollment_count
FROM users u
LEFT JOIN workshop_enrollments we ON we.user_id = u.id
WHERE u.email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
GROUP BY u.email;

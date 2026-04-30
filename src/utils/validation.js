export const validateCredentials = ({ name, password }) => {
  const errors = {};
  const trimmedName = name.trim().toLowerCase();

  if (!trimmedName) {
    errors.name = 'Name is required.';
  } else if (trimmedName.length < 3) {
    errors.name = 'Name must be at least 3 characters long.';
  }

  if (!password.trim()) {
    errors.password = 'Password is required.';
  } else if (password.trim().length < 5) {
    errors.password = 'Password must be at least 5 characters long.';
  } else if (password.length > 200) {
    errors.password = 'Password must be at most 200 characters long.';
  }

  return errors;
};

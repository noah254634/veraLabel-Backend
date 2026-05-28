export const validateSignupDto = ({ email, name, password }) => {
  if (!email || !name || !password) {
    throw new Error("All fields are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  return { email, name, password };
};
export const validateLoginDto = ({ email, password }) => {
    if(!email || !password) throw new Error("All fields are required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) throw new Error("Invalid email format");
    return {email,password};

}
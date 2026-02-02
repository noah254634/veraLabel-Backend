export const validateSignupDto = ({ email, name, password }) => {
  if (!email || !name || !password) {
    throw new Error("All fields are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new Error("Invalid password format");
  }

  return { email, name, password };
};
export const validateLoginDto = ({ email, password }) => {
    if(!email || !password) throw new Error("All fields are required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) throw new Error("Invalid email format");
    return {email,password};

}
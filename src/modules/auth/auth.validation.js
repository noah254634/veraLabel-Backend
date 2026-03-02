export const validateSignup=({email,name,password,role})=>{
    if(!email || !name || !password) throw new Error("All fields are required");
    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) throw new Error("Invalid email format");
    const passwordRegex=/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if(!passwordRegex.test(password)) throw new Error("Invalid password format");
    if(!role) throw new Error("Role is required")
        const roleMap={
            admin:"admin",
            seller:"labeler",
            buyer:"buyer"
        }
        const UserRole=roleMap[role];
        if(!UserRole) throw new Error("Invalid role");
       
    return {email,name,password,UserRole};

};
export const validateLogin=({email,password})=>{
    if(!email || !password) throw new Error("All fields are required");
    const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) throw new Error("Invalid email format");
    return {email,password};



};
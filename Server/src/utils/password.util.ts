import bcrypt from "bcrypt";

const saltRounds = 10;

export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (plainText: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(plainText, hash);
};

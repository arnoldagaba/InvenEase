import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { type LoginFormInputs } from "../schemas/loginSchema";
import { type User } from "@/store/useAuthStore";

// Define the expected successful response shape
interface LoginResponse {
    accessToken: string;
    user: User;
}

// Define the API call function
const loginApi = async (credentials: LoginFormInputs): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>("/auth/login", credentials);
    return response.data;
};

export const useLogin = () => {
    return useMutation<LoginResponse, Error, LoginFormInputs>({
        mutationFn: loginApi,
        onSuccess: (data) => {
            console.log("Mutation successful:", data);
        },
        onError: (error) => {
            console.error("Mutation error:", error);
        },
    });
};

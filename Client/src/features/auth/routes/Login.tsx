import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import { toast } from "react-toastify";
import { loginSchema, type LoginFormInputs } from "../schemas/loginSchema";
import { useAuthStore } from "@/store/useAuthStore";
import { useLogin } from "../api/useLogin";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { cn } from "@/lib/utils";

export function Login() {
    const navigate = useNavigate();
    const { login: loginUserInStore } = useAuthStore();
    const loginMutation = useLogin();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<LoginFormInputs>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = async (data: LoginFormInputs) => {
        try {
            // Call the mutation's mutate function
            const result = await loginMutation.mutateAsync(data);

            // Backend should return user info and access token upon success
            if (result.user && result.accessToken) {
                loginUserInStore(result.user, result.accessToken);
                toast.success("Login successful!");
                reset();
                navigate("/");
            } else {
                // This case should ideally not happen if the backend response is consistent
                console.error("Login response missing user or accessToken:", result);
                toast.error("Login failed: Invalid response from server.");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Login failed:", error);
            // Check for specific API error messages if available
            if (error.response?.status === 400) {
                toast.error("Invalid request. Please check your credentials.");
            } else if (error.response?.status === 429) {
                toast.error("Too many requests. Please try again later.");
            } else {
                toast.error("An unexpected error occurred.");
            }
            // Optionally reset password field on failure
            reset({ email: data.email, password: "" });
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-md sm:p-8">
                <div className="text-center">
                    {/* Logo Placeholder */}
                    {/* <Package className="mx-auto h-8 w-auto text-primary" /> */}
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in to IMS</h1>
                    <p className="text-sm text-foreground/70">Enter your credentials below</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-1">
                        <label htmlFor="email" className={cn("text-sm font-medium", errors.email && "text-destructive")}>
                            Email Address
                        </label>

                        <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            {...register("email")}
                            className={cn(errors.email && "border-destructive focus-visible:ring-destructive")}
                            disabled={isSubmitting || loginMutation.isPending} // Disable input while submitting
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1">
                        <label htmlFor="password" className={cn("text-sm font-medium", errors.password && "text-destructive")}>
                            Password
                        </label>
                        {/* TODO: Add show/hide password toggle here */}
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            {...register("password")}
                            className={cn(errors.password && "border-destructive focus-visible:ring-destructive")}
                            disabled={isSubmitting || loginMutation.isPending} // Disable input while submitting
                        />
                        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || loginMutation.isPending} // Disable button while submitting
                    >
                        {/* Optional: Show loading spinner inside button */}
                        {isSubmitting || loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                </form>

                {/* Optional: Link to forgot password */}
                <div className="text-center text-sm">
                    <Link to="/forgot-password" className="text-primary hover:underline">
                        Forgot password?
                    </Link>
                </div>
            </div>
        </div>
    );
}

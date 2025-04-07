import { ReactNode } from "react";

interface PageWrapperProps {
    title?: string;
    actions?: ReactNode;
    children: ReactNode;
}

export function PageWrapper({ title, children }: PageWrapperProps) {
    return (
        <div className="space-y-4">
            {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
            {/* Render actions here if defined */}
            <div>{children}</div>
        </div>
    );
}

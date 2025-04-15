import { HomeIcon } from "lucide-react";
import { useLocation } from "react-router";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function Breadcrumbs() {
    const location = useLocation();
    const pathnames = location.pathname.split("/").filter((x) => x);

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href="/">
                        <HomeIcon size={16} aria-hidden="true" />
                        <span className="sr-only">Home</span>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {pathnames.map((value, index) => {
                    const to = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;

                    return (
                        <li key={to} className="flex items-center">
                            <BreadcrumbSeparator className="mx-2">
                                /
                            </BreadcrumbSeparator>
                            {isLast ? (
                                <BreadcrumbPage>
                                    {value.charAt(0).toUpperCase() +
                                        value.slice(1)}
                                </BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink
                                    href={to}
                                    className="hover:underline"
                                >
                                    {value.charAt(0).toUpperCase() +
                                        value.slice(1)}
                                </BreadcrumbLink>
                            )}
                        </li>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

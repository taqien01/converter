import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type RouterContextType = {
  path: string;
  navigate: (to: string) => void;
};

const RouterContext = createContext<RouterContextType>({
  path: "/",
  navigate: () => {},
});

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const normalized = normalizePath(to);
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, "", normalized);
      setPath(normalized);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}

export function normalizePath(p: string): string {
  const trimmed = p.trim().replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function Link({
  to,
  className,
  children,
  ...props
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
          e.preventDefault();
          navigate(to);
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

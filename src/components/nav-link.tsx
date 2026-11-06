import { component$, Slot } from '@qwik.dev/core';
import { Link, useLocation, type LinkProps } from '@qwik.dev/router';

export interface NavLinkProps extends LinkProps {
    activeClass?: string;
}

export const NavLink = component$<NavLinkProps>(
    ({ activeClass, ...props }) => {

        const location = useLocation();
        const toPathname = props.href ?? '';
        const locationPathname = location.url.pathname;

        const startSlashPosition =
            toPathname !== '/' && toPathname.startsWith('/')
                ? toPathname.length - 1
                : toPathname.length;
        const endSlashPosition =
            toPathname !== '/' && toPathname.endsWith('/')
                ? toPathname.length - 1
                : toPathname.length;
        const isActive =
            locationPathname === toPathname ||
            (locationPathname.endsWith(toPathname) &&
                (locationPathname.charAt(endSlashPosition) === '/' ||
                    locationPathname.charAt(startSlashPosition) === '/'));

        return (
            <Link
                {...props}
                class={[props.class, isActive && activeClass ? activeClass : ""]}
                aria-current={isActive ? "page" : undefined}
            >
                <Slot />
            </Link>
        );
    }
);

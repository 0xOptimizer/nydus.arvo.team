'use client';

import { useNavigation } from '@/context/NavigationContext';
import { SegmentedControl } from '@/components/ui/segmented';

const HREF = {
    users: '/databases/users',
    assignments: '/databases/assignments',
} as const;

type AccessTab = keyof typeof HREF;

/**
 * In-page tab switcher between database Users and Assignments. Kept out of the
 * global top bar (which is space-constrained) — these two are closely related
 * (creating users vs. granting them database access), so they live together as
 * an in-page control instead of separate top-bar tabs.
 */
export function AccessTabs({ active }: { active: AccessTab }) {
    const { navigate } = useNavigation();
    return (
        <SegmentedControl<AccessTab>
            options={[
                { value: 'users', label: <><i className="fa-solid fa-users mr-1.5 text-[10px]" />Users</> },
                { value: 'assignments', label: <><i className="fa-solid fa-link mr-1.5 text-[10px]" />Assignments</> },
            ]}
            value={active}
            onChange={(v) => navigate(HREF[v])}
        />
    );
}

export default AccessTabs;

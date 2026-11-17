import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppUser } from '../AppUser';
import { GoalPermissionsFetcher } from '../GoalPermissionsFetcher';
import { GoalPermissionsRepository } from '../GoalPermissionsRepository';
import { GoalPermissions } from '../../types/auth.types';

vi.mock('../../modules/db', () => ({ Database: { getInstance: vi.fn(() => ({})) } }));

describe('Lista 02: Scrum project authorization', () => {
    afterEach(() => vi.restoreAllMocks());

    it('combines permissions returned from multiple collaboration roles', async () => {
        vi.spyOn(GoalPermissionsRepository.prototype, 'fetchPermissionsForGoals').mockResolvedValue([
            { goalId: 71, permissionName: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT, permissionId: 1 },
            { goalId: 71, permissionName: GoalPermissions.COMPONENT_CAN_EDIT, permissionId: 2 },
        ]);
        const user = {
            getUserData: () => ({ id: 17, email: 'synthetic@example.test' }),
            getAllowedGoalIds: () => null,
            getTokenPermissions: () => null,
        } as unknown as AppUser;

        const checker = await new GoalPermissionsFetcher(user).getCheckerForGoal(71);

        expect(checker.hasPermissions(GoalPermissions.COMPONENT_CAN_WATCH_CONTENT)).toBe(true);
        expect(checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT)).toBe(true);
        expect(checker.hasPermissions(GoalPermissions.COMPONENT_CAN_DELETE)).toBe(false);
    });

    it('intersects merged role permissions with API token scopes', async () => {
        vi.spyOn(GoalPermissionsRepository.prototype, 'fetchPermissionsForGoals').mockResolvedValue([
            { goalId: 72, permissionName: GoalPermissions.COMPONENT_CAN_WATCH_CONTENT, permissionId: 1 },
            { goalId: 72, permissionName: GoalPermissions.COMPONENT_CAN_EDIT, permissionId: 2 },
        ]);
        const user = {
            getUserData: () => ({ id: 18, email: 'scoped@example.test' }),
            getAllowedGoalIds: () => [72],
            getTokenPermissions: () => [GoalPermissions.COMPONENT_CAN_WATCH_CONTENT],
        } as unknown as AppUser;

        const checker = await new GoalPermissionsFetcher(user).getCheckerForGoal(72);

        expect(checker.hasPermissions(GoalPermissions.COMPONENT_CAN_WATCH_CONTENT)).toBe(true);
        expect(checker.hasPermissions(GoalPermissions.COMPONENT_CAN_EDIT)).toBe(false);
    });
});

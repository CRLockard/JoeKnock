import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { teamsRepository as defaultRepository } from './teamsRepository.js';

function toTeamResponse(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTeamMemberResponse(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
  };
}

function toTeamMembershipResponse(row) {
  return {
    organizationId: row.organization_id,
    teamId: row.team_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

export function createTeamsService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async listTeams({ organizationId }) {
      const teams = await runInTransaction(async (client) => {
        return repository.listTeamsByOrganization(client, { organizationId });
      });

      return teams.map(toTeamResponse);
    },

    async getTeam({ teamId, organizationId }) {
      const result = await runInTransaction(async (client) => {
        // Team lookup and member list are resolved in one transaction to keep
        // response internally consistent for a single request snapshot.
        const team = await repository.findTeamByIdAndOrganization(client, {
          teamId,
          organizationId,
        });

        if (!team) {
          return null;
        }

        const members = await repository.listTeamMembers(client, {
          teamId,
          organizationId,
        });

        return {
          team,
          members,
        };
      });

      if (!result) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Team not found.');
      }

      return {
        ...toTeamResponse(result.team),
        members: result.members.map(toTeamMemberResponse),
      };
    },

    async createTeam({ organizationId, name }) {
      const normalizedName = String(name).trim();

      const team = await runInTransaction(async (client) => {
        return repository.createTeam(client, {
          organizationId,
          name: normalizedName,
        });
      });

      if (!team) {
        throw new AppError(
          500,
          'INTERNAL_SERVER_ERROR',
          'Team creation failed.',
        );
      }

      return toTeamResponse(team);
    },

    async addUserToTeam({ organizationId, teamId, userId }) {
      try {
        const membership = await runInTransaction(async (client) => {
          // Guard parent/child references within org boundary before insert.
          const team = await repository.findTeamByIdAndOrganization(client, {
            teamId,
            organizationId,
          });

          if (!team) {
            throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Team not found.');
          }

          const user = await repository.findUserByIdAndOrganization(client, {
            userId,
            organizationId,
          });

          if (!user) {
            throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
          }

          return repository.addUserToTeam(client, {
            organizationId,
            teamId,
            userId,
          });
        });

        if (!membership) {
          throw new AppError(
            500,
            'INTERNAL_SERVER_ERROR',
            'Unable to add user to team.',
          );
        }

        return toTeamMembershipResponse(membership);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            409,
            'CONFLICT',
            'User is already a member of this team.',
          );
        }

        throw error;
      }
    },

    async removeUserFromTeam({ organizationId, teamId, userId }) {
      const removedMembership = await runInTransaction(async (client) => {
        const team = await repository.findTeamByIdAndOrganization(client, {
          teamId,
          organizationId,
        });

        if (!team) {
          throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Team not found.');
        }

        const user = await repository.findUserByIdAndOrganization(client, {
          userId,
          organizationId,
        });

        if (!user) {
          throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
        }

        return repository.removeUserFromTeam(client, {
          organizationId,
          teamId,
          userId,
        });
      });

      if (!removedMembership) {
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'Team membership not found.',
        );
      }

      return toTeamMembershipResponse(removedMembership);
    },
  };
}

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
  };
}

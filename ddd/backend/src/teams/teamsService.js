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

export function createTeamsService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
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

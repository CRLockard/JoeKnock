const PROPERTY_BY_ORG_AND_NORMALIZED_ADDRESS_SQL = `
  SELECT
    id,
    organization_id,
    latitude,
    longitude
  FROM properties
  WHERE organization_id = $1
    AND normalized_address = $2
  LIMIT 1
`;

const PROPERTY_INSERT_SQL = `
  INSERT INTO properties (
    organization_id,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    normalized_address,
    latitude,
    longitude
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING id, organization_id, latitude, longitude
`;

export const propertiesRepository = {
  async findByNormalizedAddress(client, { organizationId, normalizedAddress }) {
    const result = await client.query(
      PROPERTY_BY_ORG_AND_NORMALIZED_ADDRESS_SQL,
      [organizationId, normalizedAddress],
    );

    return result.rows[0] ?? null;
  },

  async createProperty(
    client,
    {
      organizationId,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      normalizedAddress,
      latitude,
      longitude,
    },
  ) {
    const result = await client.query(PROPERTY_INSERT_SQL, [
      organizationId,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      normalizedAddress,
      latitude,
      longitude,
    ]);

    return result.rows[0] ?? null;
  },
};

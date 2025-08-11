const VISIWISE_API_URL = 'https://www.visiwise.co/api-graphql/';
const API_TOKEN = '303d880f2196dfe75506586209cfc5e534f07384';

const graphqlQuery = async (query: string, variables = {}) => {
  const response = await fetch(VISIWISE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${API_TOKEN}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data;
};


export async function POST(request: Request) {
  try {
    const { shipmentId } = await request.json();
    
    await graphqlQuery(`
      mutation UpdateShipment($shipmentId: ID!) {
        updateShipment(shipmentId: $shipmentId) {
          success
        }
      }
    `, { shipmentId });
    
    return Response.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

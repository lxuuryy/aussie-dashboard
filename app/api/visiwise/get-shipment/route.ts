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
   
    const result = await graphqlQuery(`
      query Shipment($shipmentId: ID!) {
        shipment(id: $shipmentId) {
          id trackingReference
          containerTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            arrivalTime { value isActual }
            lastMovementEventDescription
            portOfLoading { unlocodeName }
            portOfDischarge { unlocodeName }
          }
          blTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            placeOfReceipt { unlocodeName }
            portOfLoading { unlocodeName }
            portOfDischarge { unlocodeName }
            placeOfDelivery { unlocodeName }
            containers {
              id number
              trackStatus { status }
              arrivalTime { value isActual }
            }
          }
          bookingTracking {
            id number
            trackStatus { status exception }
            shippingLine { name keyname }
            arrivalTime { value isActual }
          }
          tags { name }
        }
      }
    `, { shipmentId }

);
    console.log(result);
    return Response.json(result);
   
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
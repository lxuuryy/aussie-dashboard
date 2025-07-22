// app/api/templates/route.js
export async function POST(request) {
  try {
    const { action, templateData, templateId } = await request.json();
    
    const bearerToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJjNmU3YzM0OWEyZmY3ZDUyZmU0N2YxMDJmMzBjNzE4NGE4MGFhMjM5MDdjNTA4MzVjYmQwNGNmY2ZhZDA1NmI0Iiwic3ViIjoiYWttYWxAYXVzc2llc3RlZWxkaXJlY3QuY29tLmF1IiwiZXhwIjoxNzUzMDYyMTM4fQ.n--1sE5GkFx40SGxmkhnJUhukHFBhFH2Z59RQLf3gwA";

    let apiUrl = "";
    let method = "GET";
    let body = null;

    switch (action) {
      case 'create':
        apiUrl = "https://us1.pdfgeneratorapi.com/api/v4/templates";
        method = "POST";
        body = JSON.stringify(templateData);
        break;
      
      case 'list':
        apiUrl = "https://us1.pdfgeneratorapi.com/api/v4/templates";
        method = "GET";
        break;
      
      case 'get':
        apiUrl = `https://us1.pdfgeneratorapi.com/api/v4/templates/${templateId}`;
        method = "GET";
        break;
      
      case 'update':
        apiUrl = `https://us1.pdfgeneratorapi.com/api/v4/templates/${templateId}`;
        method = "PUT";
        body = JSON.stringify(templateData);
        break;
      
      case 'delete':
        apiUrl = `https://us1.pdfgeneratorapi.com/api/v4/templates/${templateId}`;
        method = "DELETE";
        break;
      
      default:
        throw new Error('Invalid action specified');
    }

    const response = await fetch(apiUrl, {
      method: method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: body
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Template API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    
    return Response.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Template Management Error:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
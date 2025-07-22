// app/api/generate-pdf/route.js
export async function POST(request) {
  try {
    // Get request data (if you want to make it dynamic)
    const { name, dueDate, templateId } = await request.json();

    const pdfApiUrl = "https://us1.pdfgeneratorapi.com/api/v4/documents/generate";
    
    // Use your current working JWT token
    const bearerToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJjNmU3YzM0OWEyZmY3ZDUyZmU0N2YxMDJmMzBjNzE4NGE4MGFhMjM5MDdjNTA4MzVjYmQwNGNmY2ZhZDA1NmI0Iiwic3ViIjoiYWttYWxAYXVzc2llc3RlZWxkaXJlY3QuY29tLmF1IiwiZXhwIjoxNzUzMDYyMTM4fQ.n--1sE5GkFx40SGxmkhnJUhukHFBhFH2Z59RQLf3gwA";

    const requestPayload = {
      template: {
        id: templateId || '1462431',
        data: {
          Name: name || 'Akmal Ashwin',
          DueDate: dueDate || '2025-07-21'
        }
      },
      format: 'pdf',
      output: 'url',
      name: 'Certificate Example'
    };

    const response = await fetch(pdfApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`PDF API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return Response.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// Optional: GET method for testing
export async function GET() {
  return Response.json({ 
    message: "PDF Generation API endpoint is ready. Use POST method to generate PDFs." 
  });
}
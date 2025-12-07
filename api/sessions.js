export const config = {
  api: {
    bodyParser: false, // Disable default parsing to handle FormData/Audio uploads
  },
};

export default async function handler(req, res) {
  // 1. Handle CORS (Allow your frontend to talk to this backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Preflight options request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Handle POST Request (Saving Session)
  if (req.method === 'POST') {
    try {
      // NOTE: In a real production app, you would parse the FormData (using 'formidable' or similar)
      // and save the JSON to MongoDB/Postgres and the Audio to AWS S3/Blob Storage.
      
      // Since this is a serverless function without external DB config yet, 
      // we will simulate a successful save so the Frontend shows "Synced".
      
      console.log("Received session upload request");
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return res.status(200).json({ 
        success: true, 
        message: "Session received. (Note: Configure a Database to store this permanently)" 
      });
    } catch (error) {
      console.error("Backend Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // 3. Handle Invalid Methods
  return res.status(405).json({ error: "Method not allowed" });
}
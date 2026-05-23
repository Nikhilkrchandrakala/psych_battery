import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Load the API Key
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not defined in .env or script!");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const doc1Path = 'K:\\H DRIVE\\Quantum Climb\\APPS\\SSB\\DOCS\\ANUJ_TEST FOR OCR1.pdf';
const doc2Path = 'K:\\H DRIVE\\Quantum Climb\\APPS\\SSB\\DOCS\\ANUJ_TEST FOR OCR2.pdf';

const out1Path = 'K:\\H DRIVE\\Quantum Climb\\APPS\\SSB\\DOCS\\ANUJ_TEST_FOR_OCR1_OUTPUT.txt';
const out2Path = 'K:\\H DRIVE\\Quantum Climb\\APPS\\SSB\\DOCS\\ANUJ_TEST_FOR_OCR2_OUTPUT.txt';

async function performOcr(pdfPath, outputPath) {
  console.log(`\n--- Starting OCR for: ${pdfPath} ---`);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`File does not exist: ${pdfPath}`);
    return false;
  }

  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const base64Data = fileBuffer.toString('base64');
    
    console.log(`File read successfully (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB). Sending to Gemini (gemini-2.5-flash)...`);
    
    const prompt = `You are an expert OCR and document analysis engine. Analyze this uploaded PDF, which is a handwritten or filled Personal Information Questionnaire (PIQ) or Candidate Assessment Sheet. 
Perform high-accuracy transcription of all handwritten and printed text in the document. 
Group the text logically by sections, pages, tables, and questions. 
Preserve all readable text exactly as written, including self-descriptions, sentence completions, or word association tests if present.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data
          }
        }
      ]
    });

    const textOutput = response.text;
    console.log(`OCR complete! Writing output to: ${outputPath}`);
    
    fs.writeFileSync(outputPath, textOutput, 'utf8');
    console.log(`Output successfully saved to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error processing OCR for ${pdfPath}:`, error);
    return false;
  }
}

async function main() {
  console.log("Initializing Gemini 2.5 Flash OCR Test...");
  const success1 = await performOcr(doc1Path, out1Path);
  const success2 = await performOcr(doc2Path, out2Path);
  
  if (success1 && success2) {
    console.log("\n==============================================");
    console.log("SUCCESS: OCR run successfully for both files!");
    console.log("Outputs saved under the DOCS directory.");
    console.log("==============================================");
  } else {
    console.warn("\n==============================================");
    console.warn("WARNING: Some files failed to process. See errors above.");
    console.warn("==============================================");
  }
}

main().catch(err => {
  console.error("Fatal Error in Main:", err);
});

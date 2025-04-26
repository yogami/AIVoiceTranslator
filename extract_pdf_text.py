import os
from PyPDF2 import PdfReader

def extract_text_from_pdf(pdf_path, output_dir="extracted_text"):
    """
    Extract text from a PDF file and save it to a text file.
    
    Args:
        pdf_path (str): Path to the PDF file
        output_dir (str): Directory to save the extracted text file
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Get the base name of the PDF file
        pdf_name = os.path.basename(pdf_path)
        output_name = os.path.splitext(pdf_name)[0] + ".txt"
        output_path = os.path.join(output_dir, output_name)
        
        # Extract text from the PDF
        reader = PdfReader(pdf_path)
        all_text = ""
        
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            all_text += f"\n--- Page {page_num + 1} ---\n"
            all_text += text + "\n"
        
        # Write the text to a file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(all_text)
        
        print(f"Text extracted from {pdf_path} and saved to {output_path}")
        
    except Exception as e:
        print(f"Error extracting text from {pdf_path}: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        extract_text_from_pdf(pdf_path)
    else:
        print("Please provide a PDF file path as a command line argument.")
        print("Usage: python extract_pdf_text.py path/to/pdf_file.pdf")
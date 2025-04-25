import os
from fpdf import FPDF

def text_to_pdf(text_file, pdf_file):
    """
    Convert a text file to a PDF file.
    
    Args:
        text_file (str): Path to the text file
        pdf_file (str): Path to save the PDF file
    """
    try:
        # Create PDF object
        pdf = FPDF()
        
        # Add a page
        pdf.add_page()
        
        # Set font
        pdf.set_font("Arial", size=12)
        
        # Open and read the text file
        with open(text_file, 'r', encoding='utf-8') as file:
            content = file.readlines()
        
        # Add text to PDF
        for line in content:
            # Remove trailing newlines and encode to prevent encoding issues
            clean_line = line.rstrip('\n')
            pdf.cell(0, 10, text=clean_line, ln=True)
        
        # Save the PDF
        pdf.output(pdf_file)
        print(f"Successfully created {pdf_file}")
        
    except Exception as e:
        print(f"Error creating PDF: {e}")

def main():
    # Directory where text files are located
    dir_path = "attached_assets"
    
    # Files to convert
    files_to_convert = [
        "AIVoiceTranslator_Proof_of_Concept_Modified.txt",
        "Realtime_Audio_Translation_Replit_Guide_Modified.txt",
        "Functional_Prototype_Product_Requirements_Updated_Modified.txt"
    ]
    
    # Convert each file
    for file_name in files_to_convert:
        text_file = os.path.join(dir_path, file_name)
        pdf_file = os.path.join(dir_path, file_name.replace(".txt", ".pdf"))
        
        if os.path.exists(text_file):
            text_to_pdf(text_file, pdf_file)
        else:
            print(f"File not found: {text_file}")

if __name__ == "__main__":
    main()
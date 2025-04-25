import os
import sys
from PyPDF2 import PdfReader

def check_pdf_for_text(pdf_path, search_text):
    """
    Check if the given text appears in a PDF file.
    
    Args:
        pdf_path (str): Path to the PDF file
        search_text (str): Text to search for
    
    Returns:
        list: List of page numbers where the text was found
    """
    try:
        reader = PdfReader(pdf_path)
        occurrences = []
        
        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            if search_text.lower() in text.lower():
                occurrences.append(page_num + 1)  # Page numbers start at 1
        
        return occurrences
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
        return []

def scan_directory_for_pdfs(directory, search_text):
    """
    Scan a directory for PDF files and check each one for the search text.
    
    Args:
        directory (str): Directory to scan
        search_text (str): Text to search for
    
    Returns:
        dict: Dictionary mapping PDF file paths to lists of page numbers with occurrences
    """
    results = {}
    
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_path = os.path.join(root, file)
                occurrences = check_pdf_for_text(pdf_path, search_text)
                if occurrences:
                    results[pdf_path] = occurrences
    
    return results

if __name__ == "__main__":
    search_text = "Benedictaitor"
    directory = "."
    
    print(f"Scanning for '{search_text}' in PDF files...")
    results = scan_directory_for_pdfs(directory, search_text)
    
    if not results:
        print("No occurrences found.")
    else:
        print("\nOccurrences found in the following PDF files:")
        for pdf_path, page_numbers in results.items():
            print(f"\n{pdf_path}:")
            print(f"  Found on pages: {', '.join(map(str, page_numbers))}")
            print(f"  Total occurrences: {len(page_numbers)} page(s)")
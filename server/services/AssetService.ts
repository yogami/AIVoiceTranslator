/**
 * Asset Service
 * 
 * This service handles the uploading, querying, and retrieval of project assets
 * such as PDFs, markdown files, and images stored in the database.
 */

import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { 
  assets,
  type Asset,
  type InsertAsset
} from '@shared/schema';
import { eq } from 'drizzle-orm';

class AssetService {
  /**
   * Store the Working Agreement document in the database
   * This is a special document that guides the agent's behavior
   */
  public async storeWorkingAgreement(content: string): Promise<Asset> {
    try {
      const filename = "Working_Agreement.md";
      const filetype = "md";
      
      // Metadata for the working agreement
      const metadata = {
        purpose: "Software Craftsmanship Guidance",
        priority: "critical",
        created: new Date(),
        modified: new Date()
      };
      
      // Check if working agreement already exists in database
      const [existingAgreement] = await db.select()
        .from(assets)
        .where(eq(assets.filename, filename));
      
      if (existingAgreement) {
        // Update existing asset
        const [updatedAsset] = await db.update(assets)
          .set({
            content,
            metadata,
            updated_at: new Date()
          })
          .where(eq(assets.id, existingAgreement.id))
          .returning();
        
        console.log(`Updated Working Agreement in database`);
        return updatedAsset;
      } else {
        // Create new asset
        const assetData: InsertAsset = {
          filename,
          filetype,
          content,
          metadata
        };
        
        const [result] = await db.insert(assets)
          .values(assetData)
          .returning();
        
        console.log(`Stored Working Agreement in database`);
        return result;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error storing Working Agreement:`, errorMessage);
      throw new Error(`Failed to store Working Agreement: ${errorMessage}`);
    }
  }
  
  /**
   * Fetch the Working Agreement from the database
   */
  public async getWorkingAgreement(): Promise<Asset | undefined> {
    return this.getAssetByFilename("Working_Agreement.md");
  }
  /**
   * Upload a single file to the database
   */
  public async uploadFile(filePath: string): Promise<Asset> {
    try {
      // Get file details
      const filename = path.basename(filePath);
      const filetype = path.extname(filePath).substring(1);
      const stats = await fs.stat(filePath);
      
      // Read file content
      let content = '';
      
      // For binary files like PDFs and images, we'll base64 encode the content
      if (['pdf', 'png', 'jpg', 'jpeg'].includes(filetype)) {
        const buffer = await fs.readFile(filePath);
        content = buffer.toString('base64');
      } else {
        // For text files, read as is
        content = await fs.readFile(filePath, 'utf-8');
      }
      
      // Metadata for the file
      const metadata = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
      
      // Check if file already exists in database
      const [existingAsset] = await db.select()
        .from(assets)
        .where(eq(assets.filename, filename));
      
      if (existingAsset) {
        // Update existing asset
        const [updatedAsset] = await db.update(assets)
          .set({
            content,
            metadata,
            updated_at: new Date()
          })
          .where(eq(assets.id, existingAsset.id))
          .returning();
        
        console.log(`Updated asset in database: ${filename}`);
        return updatedAsset;
      } else {
        // Create new asset
        const assetData: InsertAsset = {
          filename,
          filetype,
          content,
          metadata
        };
        
        const [result] = await db.insert(assets)
          .values(assetData)
          .returning();
        
        console.log(`Uploaded asset to database: ${filename}`);
        return result;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error uploading asset ${filePath}:`, errorMessage);
      throw new Error(`Failed to upload asset: ${errorMessage}`);
    }
  }

  /**
   * Get an asset by filename
   */
  public async getAssetByFilename(filename: string): Promise<Asset | undefined> {
    try {
      const [asset] = await db.select()
        .from(assets)
        .where(eq(assets.filename, filename));
      
      return asset;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error retrieving asset ${filename}:`, errorMessage);
      return undefined;
    }
  }

  /**
   * Get all assets
   */
  public async getAllAssets(): Promise<Asset[]> {
    try {
      return await db.select().from(assets);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error retrieving all assets:', errorMessage);
      return [];
    }
  }

  /**
   * Get assets by file type
   */
  public async getAssetsByType(filetype: string): Promise<Asset[]> {
    try {
      return await db.select()
        .from(assets)
        .where(eq(assets.filetype, filetype));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error retrieving assets of type ${filetype}:`, errorMessage);
      return [];
    }
  }

  /**
   * Delete an asset by filename
   */
  public async deleteAsset(filename: string): Promise<boolean> {
    try {
      const result = await db.delete(assets)
        .where(eq(assets.filename, filename))
        .returning();
      
      return result.length > 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error deleting asset ${filename}:`, errorMessage);
      return false;
    }
  }

  /**
   * Process a directory of assets and load them into the database
   */
  public async processDirectory(directoryPath: string): Promise<Asset[]> {
    try {
      const uploadedAssets: Asset[] = [];
      
      // Read all files in the directory
      const files = await fs.readdir(directoryPath);
      
      // Filter out directories from files list
      const filesStats = await Promise.all(
        files.map(async file => {
          const filePath = path.join(directoryPath, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, isDirectory: stats.isDirectory() };
        })
      );
      
      const regularFiles = filesStats.filter(item => !item.isDirectory);
      
      // Upload each file
      for (const { filePath } of regularFiles) {
        try {
          const asset = await this.uploadFile(filePath);
          uploadedAssets.push(asset);
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
      }
      
      console.log(`Processed ${uploadedAssets.length} files from ${directoryPath}`);
      return uploadedAssets;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing directory ${directoryPath}:`, errorMessage);
      return [];
    }
  }
}

// Export a singleton instance
export const assetService = new AssetService();
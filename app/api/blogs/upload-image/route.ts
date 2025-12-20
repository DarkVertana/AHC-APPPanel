import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { constants } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Image size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = originalName.split('.').pop() || 'jpg';
    const filename = `${timestamp}_${originalName}`;

    // Determine the correct upload directory
    // In production, ensure we're using the correct path
    const uploadDir = join(process.cwd(), 'public', 'blog', 'image');
    
    // Ensure the directory exists with proper permissions
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true, mode: 0o755 });
    } else {
      // Verify the directory is writable
      try {
        await access(uploadDir, constants.W_OK);
      } catch (accessError) {
        console.error('Upload directory is not writable:', uploadDir);
        return NextResponse.json(
          { error: 'Upload directory is not writable. Please check server permissions.' },
          { status: 500 }
        );
      }
    }

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = join(uploadDir, filename);
    
    // Write file with explicit error handling
    try {
      await writeFile(filepath, buffer, { mode: 0o644 });
      
      // Verify file was written successfully
      if (!existsSync(filepath)) {
        throw new Error('File was not created successfully');
      }
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return NextResponse.json(
        { 
          error: 'Failed to save image file',
          details: process.env.NODE_ENV === 'development' ? (writeError instanceof Error ? writeError.message : 'Unknown error') : undefined
        },
        { status: 500 }
      );
    }

    // Return the public URL path (normalized)
    // Ensure the path starts with / and doesn't have double slashes
    const imageUrl = `/blog/image/${filename}`.replace(/\/+/g, '/');

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while uploading image',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    );
  }
}


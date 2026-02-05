import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { validateApiKey } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

// GET - List all bug reports (admin)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { reporterName: { contains: search, mode: 'insensitive' } },
        { reporterEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bugReports, total, openCount, resolvedCount] = await Promise.all([
      prisma.bugReport.findMany({
        where: whereClause,
        include: {
          appUser: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bugReport.count({ where: whereClause }),
      prisma.bugReport.count({ where: { status: 'open' } }),
      prisma.bugReport.count({ where: { status: 'resolved' } }),
    ]);

    return NextResponse.json({
      success: true,
      bugReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: openCount + resolvedCount,
        open: openCount,
        resolved: resolvedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create bug report (app user via API key)
// Accepts both JSON and multipart/form-data:
//   JSON: { title, description, image (URL string), ... }
//   FormData: title, description, image (File), ... — image is uploaded to Cloudinary automatically
export async function POST(request: NextRequest) {
  try {
    let apiKey;
    try {
      apiKey = await validateApiKey(request);
    } catch (apiKeyError) {
      console.error('API key validation error:', apiKeyError);
      return NextResponse.json(
        { error: 'API key validation failed' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid API key required.' },
        { status: 401 }
      );
    }

    let title: string | null = null;
    let description: string | null = null;
    let imageUrl: string | null = null;
    let platform: string | null = null;
    let osVersion: string | null = null;
    let deviceName: string | null = null;
    let appVersion: string | null = null;
    let wpUserId: string | null = null;
    let email: string | null = null;
    let name: string | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data (image file + fields)
      const formData = await request.formData();

      title = formData.get('title') as string | null;
      description = formData.get('description') as string | null;
      platform = formData.get('platform') as string | null;
      osVersion = formData.get('osVersion') as string | null;
      deviceName = formData.get('deviceName') as string | null;
      appVersion = formData.get('appVersion') as string | null;
      wpUserId = formData.get('wpUserId') as string | null;
      email = formData.get('email') as string | null;
      name = formData.get('name') as string | null;

      // Handle image file upload
      const imageFile = formData.get('image');

      if (imageFile && imageFile instanceof File && imageFile.size > 0) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(imageFile.type)) {
          return NextResponse.json(
            { error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WEBP' },
            { status: 400 }
          );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
          return NextResponse.json(
            { error: 'Image too large. Maximum size is 10MB.' },
            { status: 400 }
          );
        }

        if (isCloudinaryConfigured()) {
          const buffer = Buffer.from(await imageFile.arrayBuffer());
          const timestamp = Date.now();
          const filename = `bug-report-${timestamp}-${imageFile.name}`;
          const result = await uploadToCloudinary(buffer, filename, 'ahc-bug-reports');
          imageUrl = result.secure_url;
        } else {
          console.warn('Cloudinary not configured, skipping image upload');
        }
      } else if (typeof imageFile === 'string' && imageFile) {
        // Image sent as URL string in form data
        imageUrl = imageFile;
      }
    } else {
      // Handle JSON body
      const body = await request.json();
      title = body.title;
      description = body.description;
      imageUrl = body.image || null;
      platform = body.platform || null;
      osVersion = body.osVersion || null;
      deviceName = body.deviceName || null;
      appVersion = body.appVersion || null;
      wpUserId = body.wpUserId || null;
      email = body.email || null;
      name = body.name || null;
    }

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'title and description are required' },
        { status: 400 }
      );
    }

    // Try to find the app user
    let appUser = null;
    if (wpUserId) {
      appUser = await prisma.appUser.findUnique({
        where: { wpUserId: String(wpUserId) },
        select: { id: true, name: true, displayName: true, email: true },
      });
    } else if (email) {
      appUser = await prisma.appUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true, name: true, displayName: true, email: true },
      });
    }

    const bugReport = await prisma.bugReport.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        image: imageUrl,
        platform: platform || null,
        osVersion: osVersion || null,
        deviceName: deviceName || null,
        appVersion: appVersion || null,
        appUserId: appUser?.id || null,
        reporterName: appUser?.displayName || appUser?.name || name || null,
        reporterEmail: appUser?.email || email || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Bug report submitted successfully',
        bugReport: {
          id: bugReport.id,
          title: bugReport.title,
          description: bugReport.description,
          image: bugReport.image,
          status: bugReport.status,
          platform: bugReport.platform,
          osVersion: bugReport.osVersion,
          deviceName: bugReport.deviceName,
          appVersion: bugReport.appVersion,
          reporterName: bugReport.reporterName,
          reporterEmail: bugReport.reporterEmail,
          createdAt: bugReport.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating bug report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

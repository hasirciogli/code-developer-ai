import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import slugify from 'slugify';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || !description) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Generate a unique slug
    const slug = slugify(name, { lower: true, strict: true });
    let isUnique = false;
    let counter = 0;

    while (!isUnique) {
      const existingProject = await prisma.project.findUnique({
        where: { slug: counter === 0 ? slug : `${slug}-${counter}` },
      });

      if (!existingProject) {
        isUnique = true;
      } else {
        counter++;
      }
    }

    const finalSlug = counter === 0 ? slug : `${slug}-${counter}`;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        slug: finalSlug,
        userId: session.user.id,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: {
        slug: (await params).slug,
        userId: session.user.id,
      },
      include: {
        files: true,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    return NextResponse.json(project.files);
  } catch (error) {
    console.error("Error fetching project files:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: {
        slug: (await params).slug,
        userId: session.user.id,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    const body = await request.json();
    const { name, path, content } = body;

    if (!name || !path || !content) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const existingFile = await prisma.file.findFirst({
      where: {
        projectId: project.id,
        path: path,
      },
    });

    if (existingFile) {
      return new NextResponse("File with this path already exists", {
        status: 400,
      });
    }

    const file = await prisma.file.create({
      data: {
        name,
        path,
        content,
        projectId: project.id,
      },
    });

    return NextResponse.json(file);
  } catch (error) {
    console.error("Error creating file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: {
        slug: (await params).slug,
        userId: session.user.id,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    const body = await request.json();
    const { path, content } = body;

    if (!path || !content) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const file = await prisma.file.findFirst({
      where: {
        projectId: project.id,
        path: path,
      },
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    const updatedFile = await prisma.file.update({
      where: {
        id: file.id,
      },
      data: {
        content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedFile);
  } catch (error) {
    console.error("Error updating file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: {
        slug: (await params).slug,
        userId: session.user.id,
      },
    });

    if (!project) {
      return new NextResponse("Project not found", { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return new NextResponse("Missing path parameter", { status: 400 });
    }

    const file = await prisma.file.findFirst({
      where: {
        projectId: project.id,
        path: path,
      },
    });

    if (!file) {
      return new NextResponse("File not found", { status: 404 });
    }

    await prisma.file.delete({
      where: {
        id: file.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DemoRequestStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";
import { ListDemoRequestsDto } from "./dto/list-demo-requests.dto";
import { UpdateDemoRequestDto } from "./dto/update-demo-request.dto";

const publicConfirmationSelect = {
  id: true,
  status: true,
  createdAt: true,
} satisfies Prisma.DemoRequestSelect;

@Injectable()
export class DemoRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  create(body: CreateDemoRequestDto) {
    if (!body.consent) {
      throw new BadRequestException("Consent is required");
    }

    const { website, ...data } = body;
    void website;
    return this.prisma.demoRequest.create({
      data,
      select: publicConfirmationSelect,
    });
  }

  async list(query: ListDemoRequestsDto) {
    const where: Prisma.DemoRequestWhereInput = {
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { businessName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [requests, total] = await this.prisma.$transaction([
      this.prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
      }),
      this.prisma.demoRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async get(id: string) {
    const request = await this.prisma.demoRequest.findUnique({ where: { id } });

    if (!request) {
      throw new NotFoundException("Demo request not found");
    }

    return request;
  }

  async update(id: string, body: UpdateDemoRequestDto) {
    await this.get(id);
    return this.prisma.demoRequest.update({
      where: { id },
      data: {
        status: body.status,
        internalNotes: body.internalNotes,
        lastContactedAt: body.lastContactedAt
          ? new Date(body.lastContactedAt)
          : undefined,
      },
    });
  }
}

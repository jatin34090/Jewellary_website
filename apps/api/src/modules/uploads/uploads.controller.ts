import { Body, Controller, Post, ServiceUnavailableException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Inject, Module } from "@nestjs/common";
import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

import { Roles } from "../../common/auth/auth.decorators";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { INTEGRATIONS } from "../../config/config.module";
import type { Integrations } from "../../config/integrations";
import { IMAGE_FORMATS, VIDEO_FORMATS, signCloudinaryParams } from "./cloudinary";

class UploadSignatureDto {
  @ApiProperty({ enum: ["image", "video"] })
  @IsIn(["image", "video"])
  kind!: "image" | "video";
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string;
  signature: string;
  resourceType: "image" | "video";
  uploadUrl: string;
}

@ApiTags("Admin: Uploads")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/uploads")
export class UploadsController {
  constructor(@Inject(INTEGRATIONS) private readonly integrations: Integrations) {}

  /**
   * Issues a short-lived signature so the browser can upload straight to Cloudinary. The API secret
   * stays on the server. The signed format list stops the upload of any other file type.
   */
  @Post("signature")
  @ApiOperation({ summary: "Get a signed upload request for a product image or video" })
  signature(@Body() dto: UploadSignatureDto): UploadSignature {
    const cloud = this.integrations.cloudinary;
    if (!cloud) {
      throw new ServiceUnavailableException(
        "Media uploads are not configured yet. Add the Cloudinary keys.",
      );
    }

    const resourceType = dto.kind;
    const folder = `${cloud.folder}/${resourceType === "video" ? "videos" : "images"}`;
    const allowedFormats = (resourceType === "video" ? VIDEO_FORMATS : IMAGE_FORMATS).join(",");
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = signCloudinaryParams(
      { allowed_formats: allowedFormats, folder, timestamp },
      cloud.apiSecret,
    );

    return {
      cloudName: cloud.cloudName,
      apiKey: cloud.apiKey,
      timestamp,
      folder,
      allowedFormats,
      signature,
      resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloud.cloudName}/${resourceType}/upload`,
    };
  }
}

@Module({
  controllers: [UploadsController],
})
export class UploadsModule {}

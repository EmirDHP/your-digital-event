import { normalizeConfig } from "../../src/invitation/core/config-normalizer.js";

function getHttpsUrl(value){
  try{
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url;
  }catch{
    return null;
  }
}

function resolveImageUrl(image, eventUrl){
  if (!image) return "";
  const baseUrl = getHttpsUrl(eventUrl);
  if (!baseUrl) return "";
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  try{
    const url = new URL(image, baseUrl);
    return url.protocol === "https:" ? url.href : "";
  }catch{
    return "";
  }
}

export function createSocialMetadata(config){
  const sharing = normalizeConfig(config).sharing;
  const eventUrl = getHttpsUrl(sharing.url);

  if (!eventUrl || !sharing.title || !sharing.description){
    return { available: false };
  }

  const image = resolveImageUrl(sharing.image, eventUrl.href);
  const hasImageDimensions = image &&
    Number.isInteger(sharing.imageWidth) && sharing.imageWidth > 0 &&
    Number.isInteger(sharing.imageHeight) && sharing.imageHeight > 0;
  return {
    available: true,
    title: sharing.title,
    description: sharing.description,
    url: eventUrl.href,
    type: "website",
    image,
    imageAlt: image ? sharing.imageAlt : "",
    imageWidth: hasImageDimensions ? sharing.imageWidth : null,
    imageHeight: hasImageDimensions ? sharing.imageHeight : null,
    twitterCard: image ? "summary_large_image" : "summary"
  };
}

export const socialMetadataInternals = Object.freeze({
  getHttpsUrl,
  resolveImageUrl
});

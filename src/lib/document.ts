import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import JSZip from "jszip";
import { personById } from "./test-data";
import { AID_ORDER_HEADING, formatOrderPerson } from "./order-format";
import type { AidRequest } from "./types";

const MATERIAL_AID_ORDER_HEADING =
  "Виплатити матеріальну допомогу для вирішення соціально-побутових питань за 2026 рік у розмірі місячного грошового забезпечення:";

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
};

const safeFilePart = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_");

const formatOrderDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
};

const buildBasisText = (request: AidRequest) => {
  const circumstances = request.circumstances?.trim();
  const additionalBasis = request.vlk?.trim();
  const supplements = [
    circumstances
      ? `довідка про обставини поранення ${circumstances}`
      : undefined,
    additionalBasis,
  ].filter(Boolean);
  const reportBasis = `Підстава: рапорт № ${request.reportNumber} від ${
    formatDate(request.reportDate)
  }`;

  return supplements.length
    ? `${reportBasis}; ${supplements.join("; ")}.`
    : `${reportBasis}.`;
};

const appendAidSection = (
  children: Paragraph[],
  requests: AidRequest[],
  heading: string,
) => {
  if (!requests.length) return;
  children.push(
    new Paragraph({
      style: "Num1",
      children: [new TextRun({ text: heading })],
    }),
    new Paragraph({ style: "Basis" }),
  );

  [...requests]
    .sort((a, b) =>
      a.reportNumber.localeCompare(b.reportNumber, "uk", { numeric: true })
    )
    .forEach((request) => {
      const person = personById.get(request.personId);
      if (!person) return;
      children.push(
        new Paragraph({
          style: "Num2",
          children: [new TextRun({ text: formatOrderPerson(person) })],
        }),
        new Paragraph({
          style: "Basis",
          children: [new TextRun({ text: buildBasisText(request) })],
        }),
        new Paragraph({ style: "Basis" }),
      );
    });
};

function buildOrderContent(requests: AidRequest[]) {
  const children: Paragraph[] = [new Paragraph({ style: "Basis" })];
  appendAidSection(
    children,
    requests.filter((request) => request.aidKind === "wellness"),
    AID_ORDER_HEADING,
  );
  appendAidSection(
    children,
    requests.filter((request) => request.aidKind === "material"),
    MATERIAL_AID_ORDER_HEADING,
  );

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 850, bottom: 1134, left: 1701 },
        },
      },
      children,
    }],
  });
}

const extractGeneratedBody = (documentXml: string) => {
  const body = documentXml.match(/<w:body>([\s\S]*?)<\/w:body>/)?.[1];
  if (!body) throw new Error("Generated DOCX is missing document body");
  return body.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, "");
};

async function createOrderBlob(document: Document, orderDate: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const response = await fetch(`${basePath}/ШАБЛОН.docx`);
  if (!response.ok) {
    throw new Error(`Template fetch failed: ${response.status}`);
  }

  const templateBytes = await response.arrayBuffer();
  const templateZip = await JSZip.loadAsync(templateBytes);
  const generatedZip = await JSZip.loadAsync(await Packer.toBuffer(document));

  const documentXml = await generatedZip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Generated DOCX is missing document.xml");
  }

  const templateDocumentXml = await templateZip
    .file("word/document.xml")
    ?.async("string");
  if (!templateDocumentXml) {
    throw new Error("Template DOCX is missing document.xml");
  }

  const contentXml = extractGeneratedBody(documentXml);
  const datedTemplateXml = templateDocumentXml.replace(
    "{{date}}",
    formatOrderDate(orderDate),
  );
  const mergedDocumentXml = datedTemplateXml.replace(
    /(<w:sectPr[\s\S]*?<\/w:sectPr>)/,
    `${contentXml}$1`,
  );
  templateZip.file("word/document.xml", mergedDocumentXml);
  return templateZip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function downloadOrderDocument(
  requests: AidRequest[],
  orderDate: string,
) {
  const document = buildOrderContent(requests);
  const blob = await createOrderBlob(document, orderDate);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = safeFilePart(`Проєкт_наказу_${orderDate}.docx`);
  link.click();
  URL.revokeObjectURL(url);
}

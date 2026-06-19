import { ReflectionsDialog } from "../../reflections-dialog/ReflectionsDialog";
import { ArtifactTitle } from "./artifact-title";
import { NavigateArtifactHistory } from "./navigate-artifact-history";
import { ArtifactCodeV3, ArtifactMarkdownV3 } from "@opencanvas/shared/types";
import { Assistant } from "@langchain/langgraph-sdk";
import {
  Download,
  FileJson,
  FileText,
  FileType,
  PanelRightClose,
  RefreshCw,
} from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import ReactDOMServer from "react-dom/server";
import remarkGfm from "remark-gfm";

interface ArtifactHeaderProps {
  isBackwardsDisabled: boolean;
  isForwardDisabled: boolean;
  setSelectedArtifact: (index: number) => void;
  currentArtifactContent: ArtifactCodeV3 | ArtifactMarkdownV3;
  isArtifactSaved: boolean;
  totalArtifactVersions: number;
  selectedAssistant: Assistant | undefined;
  artifactUpdateFailed: boolean;
  chatCollapsed: boolean;
  setChatCollapsed: (c: boolean) => void;
  resetToEmptyCanvas: () => void;
  isStreaming: boolean;
}

type ExportFormat = "json" | "markdown" | "word";

const getArtifactText = (
  content: ArtifactCodeV3 | ArtifactMarkdownV3
): string => {
  return content.type === "text" ? content.fullMarkdown : content.code;
};

const getDownloadName = (
  content: ArtifactCodeV3 | ArtifactMarkdownV3,
  extension: string
) => {
  const safeTitle = content.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeTitle || "untitled-document"}.${extension}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const markdownToHtml = (markdown: string) =>
  ReactDOMServer.renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
  );

const getWordHtml = (content: ArtifactCodeV3 | ArtifactMarkdownV3) => {
  const body =
    content.type === "text"
      ? markdownToHtml(content.fullMarkdown)
      : `<pre><code>${escapeHtml(content.code)}</code></pre>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(content.title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #111827;
      line-height: 1.5;
    }
    h1, h2, h3, h4 {
      color: #111827;
      margin: 18pt 0 8pt;
    }
    h1 {
      font-size: 24pt;
    }
    h2 {
      font-size: 18pt;
    }
    h3 {
      font-size: 14pt;
    }
    p {
      margin: 0 0 10pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1px solid #9ca3af;
      padding: 6pt;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: bold;
    }
    pre {
      white-space: pre-wrap;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 10pt;
    }
    blockquote {
      border-left: 3pt solid #d1d5db;
      margin-left: 0;
      padding-left: 10pt;
      color: #4b5563;
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
};

const downloadFile = (filename: string, mimeType: string, content: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const exportArtifact = (
  content: ArtifactCodeV3 | ArtifactMarkdownV3,
  format: ExportFormat
) => {
  const artifactText = getArtifactText(content);

  if (format === "json") {
    downloadFile(
      getDownloadName(content, "json"),
      "application/json",
      JSON.stringify(
        {
          title: content.title,
          type: content.type,
          content: artifactText,
          artifact: content,
        },
        null,
        2
      )
    );
    return;
  }

  if (format === "markdown") {
    const markdown =
      content.type === "text"
        ? artifactText
        : `\`\`\`${content.language}\n${artifactText}\n\`\`\`\n`;
    downloadFile(getDownloadName(content, "md"), "text/markdown", markdown);
    return;
  }

  downloadFile(
    getDownloadName(content, "doc"),
    "application/msword",
    getWordHtml(content)
  );
};

export function ArtifactHeader(props: ArtifactHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-center gap-2">
        {props.chatCollapsed && (
          <TooltipIconButton
            tooltip="Expand Chat"
            variant="ghost"
            className="ml-2 mb-1 w-8 h-8"
            delayDuration={400}
            onClick={() => props.setChatCollapsed(false)}
          >
            <PanelRightClose className="text-gray-600" />
          </TooltipIconButton>
        )}
        <ArtifactTitle
          title={props.currentArtifactContent.title}
          isArtifactSaved={props.isArtifactSaved}
          artifactUpdateFailed={props.artifactUpdateFailed}
        />
      </div>
      <div className="flex gap-2 items-end mt-[10px] mr-[6px]">
        <TooltipIconButton
          tooltip="Start from empty canvas"
          variant="ghost"
          className="mb-1 w-8 h-8"
          delayDuration={400}
          disabled={props.isStreaming}
          onClick={props.resetToEmptyCanvas}
        >
          <RefreshCw className="text-gray-600" />
        </TooltipIconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mb-1 w-8 h-8 p-1"
            >
              <Download className="text-gray-600" />
              <span className="sr-only">Save document</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                exportArtifact(props.currentArtifactContent, "json")
              }
            >
              <FileJson />
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                exportArtifact(props.currentArtifactContent, "markdown")
              }
            >
              <FileText />
              Markdown
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                exportArtifact(props.currentArtifactContent, "word")
              }
            >
              <FileType />
              Word
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NavigateArtifactHistory
          isBackwardsDisabled={props.isBackwardsDisabled}
          isForwardDisabled={props.isForwardDisabled}
          setSelectedArtifact={props.setSelectedArtifact}
          currentArtifactIndex={props.currentArtifactContent.index}
          totalArtifactVersions={props.totalArtifactVersions}
        />
        <ReflectionsDialog selectedAssistant={props.selectedAssistant} />
      </div>
    </div>
  );
}

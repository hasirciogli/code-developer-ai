import fs from "fs/promises";
import path from "path";

// Güvenlik: Sadece proje çalışma dizinine erişimi kısıtla
const WORKSPACE_ROOT = process.cwd();

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Belirtilen dosyanın içeriğini okur.
 * Güvenlik: Sadece proje dizini içindeki dosyalara erişime izin verir.
 * @param relativePath Proje kök dizinine göre dosya yolu.
 * @returns Dosya içeriği veya hata mesajı içeren bir nesne.
 */
export async function readFileTool(relativePath: string): Promise<ToolResult> {
  try {
    const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);

    // Güvenlik Kontrolü: Dosyanın hala çalışma dizini içinde olduğundan emin ol
    if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
      console.error(
        `readFileTool Error: Path traversal attempt detected: ${relativePath}`
      );
      return {
        success: false,
        error: "Erişim reddedildi: Geçersiz dosya yolu.",
      };
    }

    // Güvenlik Kontrolü: node_modules veya .git gibi hassas dizinlere erişimi engelle
    if (
      relativePath.includes("node_modules") ||
      relativePath.includes(".git") ||
      relativePath.includes(".next")
    ) {
      console.error(
        `readFileTool Error: Access denied to sensitive directory: ${relativePath}`
      );
      return {
        success: false,
        error: "Erişim reddedildi: Hassas dizine erişilemez.",
      };
    }

    const content = await fs.readFile(absolutePath, "utf-8");
    return { success: true, data: content };
  } catch (error: any) {
    console.error(`readFileTool Error reading ${relativePath}:`, error);
    if (error.code === "ENOENT") {
      return { success: false, error: `Dosya bulunamadı: ${relativePath}` };
    }
    return {
      success: false,
      error: `Dosya okunurken hata oluştu: ${
        error.message || "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Belirtilen dizinin içeriğini listeler (dosyalar ve alt dizinler).
 * Güvenlik: Sadece proje dizini içindeki dizinlere erişime izin verir.
 * @param relativePath Proje kök dizinine göre dizin yolu.
 * @returns Dizin içeriği listesi veya hata mesajı içeren bir nesne.
 */
export async function listFilesTool(relativePath: string): Promise<ToolResult> {
  try {
    const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);

    // Güvenlik Kontrolü: Dizinin hala çalışma dizini içinde olduğundan emin ol
    if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
      console.error(
        `listFilesTool Error: Path traversal attempt detected: ${relativePath}`
      );
      return {
        success: false,
        error: "Erişim reddedildi: Geçersiz dizin yolu.",
      };
    }

    // Güvenlik Kontrolü: node_modules veya .git gibi hassas dizinlere erişimi engelle
    if (
      relativePath.includes("node_modules") ||
      relativePath.includes(".git") ||
      relativePath.includes(".next")
    ) {
      console.error(
        `listFilesTool Error: Access denied to sensitive directory: ${relativePath}`
      );
      return {
        success: false,
        error: "Erişim reddedildi: Hassas dizine erişilemez.",
      };
    }

    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const fileList = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
    return { success: true, data: fileList };
  } catch (error: any) {
    console.error(`listFilesTool Error listing ${relativePath}:`, error);
    if (error.code === "ENOENT") {
      return { success: false, error: `Dizin bulunamadı: ${relativePath}` };
    }
    return {
      success: false,
      error: `Dizin listelenirken hata oluştu: ${
        error.message || "Bilinmeyen hata"
      }`,
    };
  }
}

// Kullanılabilir araçların tanımı (AI modeline gönderilecek)
export const availableTools = {
  readFile: {
    name: "readFile",
    description:
      "Belirtilen bir dosyanın içeriğini okur. Yolu proje kök dizinine göre belirtin.",
    parameters: {
      type: "object",
      properties: {
        relativePath: {
          type: "string",
          description:
            "Okunacak dosyanın proje kök dizinine göre göreceli yolu (örneğin, 'src/components/Button.tsx').",
        },
      },
      required: ["relativePath"],
    },
  },
  listFiles: {
    name: "listFiles",
    description:
      "Belirtilen bir dizinin içindeki dosya ve klasörleri listeler. Yolu proje kök dizinine göre belirtin.",
    parameters: {
      type: "object",
      properties: {
        relativePath: {
          type: "string",
          description:
            "İçeriği listelenecek dizinin proje kök dizinine göre göreceli yolu (örneğin, 'src/lib' veya '.').",
        },
      },
      required: ["relativePath"],
    },
  },
  // Gelecekte eklenebilecek diğer araçlar (writeFile, editFile vb.)
};

// Araç fonksiyonlarını isimleriyle eşleştirme
export const toolExecutors: {
  [key: string]: (args: any) => Promise<ToolResult>;
} = {
  readFile: (args) => readFileTool(args.relativePath),
  listFiles: (args) => listFilesTool(args.relativePath),
};

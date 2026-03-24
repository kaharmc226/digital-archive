export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink: string;
  thumbnailLink?: string;
  size?: string;
  createdTime: string;
  isFolder?: boolean;
}

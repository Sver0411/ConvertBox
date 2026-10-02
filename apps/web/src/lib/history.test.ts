import {it,expect} from 'vitest';
import {legacyHistoryTool} from './history';
it('maps historical conversion records to the correct tool family',()=>{
 for(const input of ['DOCX','xls','odp'])expect(legacyHistoryTool(input)).toBe('document.convert');
 for(const input of ['bmp','GIF','heif','tif'])expect(legacyHistoryTool(input)).toBe('image.convert');
 expect(legacyHistoryTool('aac')).toBe('audio.convert');expect(legacyHistoryTool('pdf')).toBe('pdf.convert');expect(legacyHistoryTool('mov')).toBe('video.convert');expect(legacyHistoryTool('unknown')).toBe('file.inspect');
});

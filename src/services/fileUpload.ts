import { supabase } from '../lib/supabase';

export const uploadFile = async (file: File, folder: string = 'resumes'): Promise<string> => {
    try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        // Upload file to Supabase Storage
        const { error } = await supabase.storage
            .from('form-uploads')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('form-uploads')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('File upload failed:', error);
        throw new Error('Failed to upload file. Please try again.');
    }
};

export const deleteFile = async (fileUrl: string): Promise<void> => {
    try {
        // Extract file path from URL
        const urlParts = fileUrl.split('/form-uploads/');
        if (urlParts.length < 2) return;

        const filePath = urlParts[1];

        const { error } = await supabase.storage
            .from('form-uploads')
            .remove([filePath]);

        if (error) {
            console.error('Delete error:', error);
            throw error;
        }
    } catch (error) {
        console.error('File deletion failed:', error);
    }
};

import cloudinary from 'cloudinary'

// Subir imagen desde archivo temporal
export const uploadImage = async (tempFilePath, folder) => {
  const result = await cloudinary.v2.uploader.upload(tempFilePath, { folder })
  return result.secure_url
}

// Eliminar imagen por su public_id
// La url de Cloudinary tiene este formato:
// https://res.cloudinary.com/nombre/image/upload/v123/folder/public_id.jpg
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return
  const parts = imageUrl.split('/')
  const fileName = parts[parts.length - 1].split('.')[0]
  const folder   = parts[parts.length - 2]
  const publicId = `${folder}/${fileName}`
  await cloudinary.v2.uploader.destroy(publicId)
}
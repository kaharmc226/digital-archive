import { getUserProfile, getOrCreatePersonalFolder } from './src/lib/permissions';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const email = 'kaharmunajat12@gmail.com';
  console.log('Testing for:', email);
  
  try {
    const profile = await getUserProfile(email);
    console.log('Profile:', profile);
    
    if (profile.hasAccess && !profile.isAdmin) {
      console.log('Creating personal folder...');
      const folderId = await getOrCreatePersonalFolder(profile.name, profile.email);
      console.log('Got Folder ID:', folderId);
    }
  } catch (e) {
    console.error('Test Error:', e);
  }
}

test();

import { Box } from '@chakra-ui/react';
import { SinglePlayerScene } from '../game/Scenes/SinglePlayerScene';
import { usePhaserGame } from '../hooks/usePhaserGame';

const CONTAINER_ID = 'game-container';

export default function SinglePlayerGame({ levelData, onReturnHome }) {
  usePhaserGame({
    parentId: CONTAINER_ID,
    sceneKey: 'SinglePlayerScene',
    SceneClass: SinglePlayerScene,
    sceneData: { level: levelData, onReturnHome },
  });

  return (
    <Box
      width="100vw"
      height="100vh"
      backgroundColor="#000000"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box id={CONTAINER_ID} width="100%" maxWidth="2560px" height="100%" maxHeight="1440px" />
    </Box>
  );
}

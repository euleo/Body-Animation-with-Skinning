// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +//attribute per dati che differiscono per ogni vertice
  'attribute vec4 a_Normal;\n' +
  'attribute vec4 a_Weight;\n' +  
  'attribute vec4 a_Color;\n' + 
  'attribute vec2 a_TexCoord;\n' +  
  'uniform mat4 u_VpMatrix;\n' +//uniform per dati uguali in ogni vertice
  'uniform mat4 u_BoneMatrix[2];\n' +  
  'uniform mat4 u_NormalMatrix;\n' +
  'varying vec4 v_Color;\n' +//varying per variabili che vengono passate al fragment shader
  'varying vec2 v_TexCoord;\n' +  
  'void main() {\n' +
  // Weight normalization factor
  '  float normfac = 1.0 / (a_Weight[0] + a_Weight[1]);\n' +  
  '  gl_Position = u_VpMatrix * normfac * (u_BoneMatrix[0] * a_Position * a_Weight[0] + u_BoneMatrix[1] * a_Position * a_Weight[1]);\n' +
  // Shading calculation to make the arm look three-dimensional
  '  vec3 lightDirection = normalize(vec3(0.0, 0.5, 0.7));\n' + //viene normalizzata per evitare che il colore della superficie diventi troppo scuro o troppo chiaro
  '  vec4 color = a_Color;\n' +  // Robot color
  '  vec3 normal = normalize((u_NormalMatrix * a_Normal).xyz);\n' +
  '  float nDotL = max(dot(normal, lightDirection), 0.0);\n' +//il prodotto scalare(dot) tra normale(=orientazione della superficie) e direzione della luce ci dà l'angolo
  '  v_Color = vec4(color.rgb * nDotL + vec3(0.1), color.a);\n' +//diffuse reflection
  ' v_TexCoord = a_TexCoord;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'varying vec4 v_Color;\n' +
  'uniform sampler2D u_Sampler;\n' +
  'varying vec2 v_TexCoord;\n' +
  'void main() {\n' +
  ' gl_FragColor = texture2D(u_Sampler, v_TexCoord) * v_Color;\n' +
  '}\n';
  
  var img_path1;
  var img_path2;
  var img_path3;
  var texture1;  
  var texture2;
  var texture3;
  
function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // Set the vertex information
  var n = initVertexBuffers(gl);
  if (n < 0) {
    console.log('Failed to set the vertex information');
    return;
  }
  
  // Set the clear color and enable the depth test
  gl.clearColor(0.6, 0.8, 1.0, 1.0);
  gl.enable(gl.DEPTH_TEST);//abilita la rimozione di superfici nascoste dietro altri oggetti, per rimuovere richiede gl.clear(gl.DEPTH_BUFFER_BIT) (vedi draw())

  // Get the storage locations of uniform variables
  var u_VpMatrix = gl.getUniformLocation(gl.program, 'u_VpMatrix');
  var u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  var u_BoneMatrix0 = gl.getUniformLocation(gl.program, 'u_BoneMatrix[0]');
  var u_BoneMatrix1 = gl.getUniformLocation(gl.program, 'u_BoneMatrix[1]');  
  if (!u_VpMatrix || !u_NormalMatrix || !u_BoneMatrix0 || !u_BoneMatrix1) {
    console.log('Failed to get the storage location');
    return;
  }

  // Calculate the view projection matrix
  var viewProjMatrix = new Matrix4();
  viewProjMatrix.setPerspective(52.0, canvas.width / canvas.height, 1.0, 100.0);//setPerspective(fov, aspect, near, far) pag.257
  viewProjMatrix.lookAt(0.0, 0.0, 40.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);//setLookAt(eyeX, eyeY, eyeZ, atX, atY, atZ, upX, upY, upZ) pag.228

  img_path1 = '33879.png'; //body   
  img_path2 = 'avatar-stormtrooper-256.png'; //head 
  img_path3 = 'white.jpg'; //floor
  
  // Set texture1 body
  if (!initTextures(gl, n, canvas, img_path1, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, 1)) {
    console.log('Failed to intialize the texture 1.');
    return;
  }  
  
  // Register the event handler to be called on key press
  document.onkeydown = function(ev){ keydown(ev, gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture1, texture2, texture3); };  
}

var ANGLE_STEP = 3.0;     // The increments of rotation angle (degrees)

//inizializzazione angoli di rotazione
var g_torsoAngle = 0.0;
var g_headAngle = 0.0;
var g_leftUpperArmAnglez = 90.0;//non cambia
var g_leftUpperArmAnglex = 0.0;//cambia coi tasti x,z
var g_leftLowerArmAngle = 0.0;//all'inizio è già ruotato di 90 grazie  a g_leftUpArmAngle
var g_rightUpperArmAnglez = -90.0;//non cambia
var g_rightUpperArmAnglex = 0.0;//cambia coi tasti x,z
var g_rightLowerArmAngle = 0.0;//all'inizio è già ruotato di -90 grazie  a g_rightUpArmAngle
var g_leftUpperLegAngle = 180.0;
var g_leftLowerLegAngle = 0.0;
var g_rightUpperLegAngle = -180.0;
var g_rightLowerLegAngle = 0.0;

function keydown(ev, gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture1, texture2, texture3) {
  switch (ev.keyCode) {
	case 39: // Right arrow key -> the positive rotation of torso around the y-axis
      g_torsoAngle = (g_torsoAngle + ANGLE_STEP) % 360;
      break;
    case 37: // Left arrow key -> the negative rotation of torso around the y-axis
      g_torsoAngle = (g_torsoAngle - ANGLE_STEP) % 360;
      break; 
    case 40: // Up arrow key -> the positive rotation of head around the z-axis
      if (g_headAngle < 45.0) g_headAngle += ANGLE_STEP;
      break;
    case 38: // Down arrow key -> the negative rotation of head around the z-axis
      if (g_headAngle > -45.0) g_headAngle -= ANGLE_STEP;
      break;
    case 90: // 'ｚ'key -> the positive rotation of arms
      if (g_leftUpperArmAnglex > 0.0) g_leftUpperArmAnglex = (g_leftUpperArmAnglex - ANGLE_STEP) % 360;
      if (g_rightUpperArmAnglex > 0.0) g_rightUpperArmAnglex = (g_rightUpperArmAnglex - ANGLE_STEP) % 360;
      break; 
    case 88: // 'x'key -> the negative rotation of arms
      if (g_leftUpperArmAnglex < 90.0) g_leftUpperArmAnglex = (g_leftUpperArmAnglex + ANGLE_STEP) % 360;
      if (g_rightUpperArmAnglex < 90.0) g_rightUpperArmAnglex = (g_rightUpperArmAnglex + ANGLE_STEP) % 360;
      break;
    case 67: // 'c'key -> the positive rotation of lower arms
      if (g_leftLowerArmAngle > 0.0)  g_leftLowerArmAngle = (g_leftLowerArmAngle - ANGLE_STEP) % 360;
      if (g_rightLowerArmAngle > 0.0)  g_rightLowerArmAngle = (g_rightLowerArmAngle - ANGLE_STEP) % 360;
      break;
    case 86: // 'v'key -> the nagative rotation of lower arms
      if (g_leftLowerArmAngle < 90.0) g_leftLowerArmAngle = (g_leftLowerArmAngle + ANGLE_STEP) % 360;
      if (g_rightLowerArmAngle < 90.0) g_rightLowerArmAngle = (g_rightLowerArmAngle + ANGLE_STEP) % 360;
      break;
	case 87: // 'w'key -> the positive rotation of lower legs
      if (g_leftLowerLegAngle < 0.0)  g_leftLowerLegAngle = (g_leftLowerLegAngle + ANGLE_STEP) % 360;
      if (g_rightLowerLegAngle < 0.0)  g_rightLowerLegAngle = (g_rightLowerLegAngle + ANGLE_STEP) % 360;
      break;
    case 83: // 's'key -> the nagative rotation of lower legs
      if (g_leftLowerLegAngle > -90.0) g_leftLowerLegAngle = (g_leftLowerLegAngle - ANGLE_STEP) % 360;
      if (g_rightLowerLegAngle > -90.0) g_rightLowerLegAngle = (g_rightLowerLegAngle - ANGLE_STEP) % 360;
      break;
    default: return; // Skip drawing at no effective action
  }   
  
　 draw(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture1); // Draw the robot arm  
　 draw2(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture2); // Draw the robot arm
　 draw3(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture3); // Draw the robot arm  	    	  
}

function initVertexBuffers(gl) {
		
  // Coordinates（Cube which length of one side is 1 with the origin on the center of the bottom)
  var vertices = new Float32Array([
    0.5, 1.0, 0.5,  0.0, 1.0, 0.5,  0.0, 0.5, 0.5,  0.5, 0.5, 0.5, //first quadrant - front
    0.0, 1.0, 0.5, -0.5, 1.0, 0.5, -0.5, 0.5, 0.5,  0.0, 0.5, 0.5, //second quadrant
    0.0, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.0, 0.5,  0.0, 0.0, 0.5, //third quadrant
    0.5, 0.5, 0.5,  0.0, 0.5, 0.5,  0.0, 0.0, 0.5,  0.5, 0.0, 0.5, //fourth quadrant	
	
    0.5, 1.0,-0.5,  0.5, 1.0, 0.0,  0.5, 0.5, 0.0,  0.5, 0.5,-0.5, //right
    0.5, 1.0, 0.0,  0.5, 1.0, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5, 0.0, 
    0.5, 0.5, 0.0,  0.5, 0.5, 0.5,  0.5, 0.0, 0.5,  0.5, 0.0, 0.0, 
    0.5, 0.5,-0.5,  0.5, 0.5, 0.0,  0.5, 0.0, 0.0,  0.5, 0.0,-0.5,	
	
	0.5, 1.0, -0.5,  0.0, 1.0, -0.5,  0.0, 1.0, 0.0,  0.5, 1.0, 0.0, //up
	0.0, 1.0, -0.5, -0.5, 1.0, -0.5, -0.5, 1.0, 0.0,  0.0, 1.0, 0.0, 
	0.0, 1.0, 0.0,  -0.5, 1.0, 0.0,  -0.5, 1.0, 0.5,  0.0, 1.0, 0.5,
	0.5, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.5,  0.5, 1.0, 0.5,
	
    -0.5, 1.0,-0.5,  -0.5, 1.0, 0.0,  -0.5, 0.5, 0.0,  -0.5, 0.5,-0.5, // left
    -0.5, 1.0, 0.0,  -0.5, 1.0, 0.5,  -0.5, 0.5, 0.5,  -0.5, 0.5, 0.0, 
    -0.5, 0.5, 0.0,  -0.5, 0.5, 0.5,  -0.5, 0.0, 0.5,  -0.5, 0.0, 0.0, 
    -0.5, 0.5,-0.5,  -0.5, 0.5, 0.0,  -0.5, 0.0, 0.0,  -0.5, 0.0,-0.5,		
	
	0.5, 0.0, -0.5,  0.0, 0.0, -0.5,  0.0, 0.0, 0.0,  0.5, 0.0, 0.0, // down
	0.0, 0.0, -0.5, -0.5, 0.0, -0.5, -0.5, 0.0, 0.0,  0.0, 0.0, 0.0, 
	0.0, 0.0, 0.0,  -0.5, 0.0, 0.0,  -0.5, 0.0, 0.5,  0.0, 0.0, 0.5,
	0.5, 0.0, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 0.5,  0.5, 0.0, 0.5,	
	
    0.5, 1.0, -0.5,  0.0, 1.0, -0.5,  0.0, 0.5, -0.5,  0.5, 0.5, -0.5, // back
    0.0, 1.0, -0.5, -0.5, 1.0, -0.5, -0.5, 0.5, -0.5,  0.0, 0.5, -0.5, 
    0.0, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.0, -0.5,  0.0, 0.0, -0.5, 
    0.5, 0.5, -0.5,  0.0, 0.5, -0.5,  0.0, 0.0, -0.5,  0.5, 0.0, -0.5		
  ]);

  // Normal
  var normals = new Float32Array([
    0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, // front
    0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 
    0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 
    0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, 
	
    1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, // right
    1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, 
    1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, 
    1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, 
	
    0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, // up
    0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, 
    0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, 
    0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, 
	
   -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, // left
   -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, 
   -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, 
   -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, 
   
    0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0, // down
    0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,
    0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,
    0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,
	
    0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0, // back
    0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0, 
    0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0, 
    0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0  
	]);

  // Indices of the vertices
  var indices = new Uint8Array([
     0, 1, 2,   0, 2, 3,// front
     4, 5, 6,   4, 6, 7,    
     8, 9,10,   8,10,11,    
    12,13,14,  12,14,15,    
    16,17,18,  16,18,19,//right
    20,21,22,  20,22,23,    
	24,25,26,  24,26,27,   
	28,29,30,  28,30,31,
    32,33,34,  32,34,35,//up
	36,37,38,  36,38,39,
	40,41,42,  40,42,43,
	44,45,46,  44,46,47,
	48,49,50,  48,50,51,//left
	52,53,54,  52,54,55,
	56,57,58,  56,58,59,
	60,61,62,  60,62,63,
	64,65,66,  64,66,67,//down
	68,69,70,  68,70,71,
	72,73,74,  72,74,75,
	76,77,78,  76,78,79,
	80,81,82,  80,82,83,//back
	84,85,86,  84,86,87,
	88,89,90,  88,90,91,
    92,93,94,  92,94,95	
  ]);

  // Write the vertex property to buffers (coordinates, normals)
  if (!initArrayBuffer(gl, 'a_Position', vertices, gl.FLOAT, 3)) return -1;//3 sarà usato per specificare il numero di componenti per vertice nel buffer object
  if (!initArrayBuffer(gl, 'a_Normal', normals, gl.FLOAT, 3)) return -1;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Write the indices to the buffer object
  var indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);  
  
  return indices.length;
}

function initArrayBuffer(gl, attribute, data, type, num) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return false;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);//gl.bindBuffer(target, buffer) abilita il buffer object e lo lega al target; gl.ARRAY_BUFFER specifica che il buffer contiene vertici pag.75 
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);//gl.bufferData(target, data, usage) scrive i dati(data) nel buffer legato al target pag.77

  // Assign the buffer object to the attribute variable
  var a_attribute = gl.getAttribLocation(gl.program, attribute);
  if (a_attribute < 0) {
    console.log('Failed to get the storage location of ' + attribute);
    return false;
  }
  gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);//gl.vertexAttribPointer(location, size, type, normalized, stride,offset) assegna il buffer object legato a gl.ARRAY_BUFFER alla attribute variable specificata da location
															  //size=numero di componenti per vertice nel buffer object
  // Enable the assignment of the buffer object to the attribute variable
  gl.enableVertexAttribArray(a_attribute);

  return true;
}

function initTextures(gl, n, canvas, img_path, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texnum) {
  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the Texture object');
    return null;
  }

  // Get storage location of u_Sampler
  var u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
  if (!u_Sampler) {
    console.log('Failed to get the storage location of u_Sampler');
    return null;
  }

  var image = new Image();  // Create image object
  image.crossOrigin = "anonymous";//aggiunto da eugenio perchè dava cross origin error
  if (!image) {
    console.log('Failed to create the Image object');
    return null;
  }
  
  // Register the event handler to be called when image loading is completed
  image.onload = function() {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  
  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler, 0);
  gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture

  if(texnum == 1){  
	texture1 = texture;
    
    if (!initTextures(gl, n, canvas, img_path2, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, 2)) {
    console.log('Failed to intialize the texture 2.');
    return;
    }
  }
  
  if(texnum == 2){ 
	texture2 = texture;
  
    if (!initTextures(gl, n, canvas, img_path3, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, 3)) {
      console.log('Failed to intialize the texture 3.');
      return;
    } 	
  }
  
  if(texnum == 3){ 
	texture3 = texture;
  
	draw(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture1); // Draw the robot arm  
	draw2(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture2); // Draw the robot arm	
	draw3(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture3); // Draw the robot arm
  }
 };

  // Tell the browser to load an Image  
  image.src = img_path;//deve stare nella stessa cartella del javascript sennò non lo trova
  
  return true;
}

// Coordinate transformation matrix
var g_BoneMatrix0 = new Matrix4(), g_BoneMatrix1 = new Matrix4(), g_BoneMatrix2 = new Matrix4(), g_BoneMatrix3 = new Matrix4(), g_BoneMatrix4 = new Matrix4(), g_BoneMatrix5 = new Matrix4(), g_BoneMatrix6 = new Matrix4(), g_BoneMatrix7 = new Matrix4(), g_BoneMatrix8 = new Matrix4(), g_BoneMatrix9 = new Matrix4(), g_BoneMatrix10 = new Matrix4(), g_BoneMatrix11 = new Matrix4(), g_BoneMatrix12 = new Matrix4(), g_BoneMatrix13 = new Matrix4();
  var torsoHeight = 10.0;
  var torsoWidth = 10.0;
  var torsoDepth = 5.0;
  var neckHeight = torsoHeight/5;
  var neckWidth = torsoWidth/4;
  var neckDepth = torsoDepth/4;  
  
function draw(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture) {
  console.log('draw body');

  // Clear color and depth buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //0 Draw torso
  g_BoneMatrix0.setTranslate(0.0, -6.0, 0.0);
  g_BoneMatrix0.rotate(g_torsoAngle, 0.0, 1.0, 0.0);  // Rotate around the y-axis rotate(ANGLE,x,y,z)
  
  var weightTorso = new Float32Array([//vanno messi nell'ordine dei vertici
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, //front
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 				
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
	                                             
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, //right
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
	                                             
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, // up				
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
	                                             
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, // left
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,				
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
	                                             
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, // down
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
	                                             
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, // back				
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0 	
  ]);  
  
  pushMatrix(g_BoneMatrix0);//for neck 
  pushMatrix(g_BoneMatrix0);//for leftArms
  pushMatrix(g_BoneMatrix0);//for rightArms
  pushMatrix(g_BoneMatrix0);//for leftLegs
  pushMatrix(g_BoneMatrix0);//for rightLegs  
  
  g_BoneMatrix0.scale(torsoWidth, torsoHeight, torsoDepth);

  //1 Draw neck
  g_BoneMatrix1 = popMatrix();
  g_BoneMatrix1.translate(0.0, torsoHeight, 0.0);     // Move onto the torso

  var weightNeck = new Float32Array([
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, //front
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, 
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0, 
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0, 
	
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, //right 
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, 
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0, 
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0, 
	
    0.8, 0.2,	0.8, 0.2,	0.8, 0.2,	0.8, 0.2, // up
	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,
	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,
	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,	0.8, 0.2,

    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, // left
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1,
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0,
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0,

	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, // down 				
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
    1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 
	1.0, 0.0,	1.0, 0.0,	1.0, 0.0,	1.0, 0.0, 

    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1, // back
    0.8, 0.2,	0.8, 0.2,	0.9, 0.1,	0.9, 0.1,
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0,
	0.9, 0.1,	0.9, 0.1,	1.0, 0.0,	1.0, 0.0,
  ]);
  
  var headHeight = torsoHeight/2;
  var headWidth = torsoWidth/2;
  var headDepth = torsoDepth/2; 
  g_BoneMatrix10.set(g_BoneMatrix1);

  g_BoneMatrix1.scale(neckWidth, neckHeight, neckDepth);

  g_BoneMatrix10.translate(0.0, neckHeight, 0.0);
  g_BoneMatrix10.rotate(g_headAngle, 1.0, 0.0, 0.0);  // Rotate around the x-axis
  g_BoneMatrix10.scale(headWidth, headHeight, headDepth);  
  
  g_BoneMatrix2 = popMatrix();
 
  //2 leftUpperArm
  var leftUpperArmLength = torsoHeight/3;
  g_BoneMatrix2.translate(-torsoWidth/2, torsoHeight-2.0, 0.0);
  g_BoneMatrix2.rotate(g_leftUpperArmAnglez, 0.0, 0.0, 1.0);  // Rotate around the z-axis
  g_BoneMatrix2.rotate(g_leftUpperArmAnglex, 1.0, 0.0, 0.0);  // Rotate around the x-axis (perchè è come se fosse verticale anche se è stato prima ruotato lungo z)

  var weightLeftUpperArm = weightNeck;  
  
  //3 leftLowerArm
  var leftLowerArmLength = torsoHeight/3;

  g_BoneMatrix3.set(g_BoneMatrix2);
  
  g_BoneMatrix2.scale(3.0, leftUpperArmLength, 3.0);  
  
  g_BoneMatrix3.translate(0.0, leftUpperArmLength, 0.0); 
  g_BoneMatrix3.rotate(-g_leftLowerArmAngle, 0.0, 0.0, 1.0);  // Rotate around the z-axis
  g_BoneMatrix3.scale(2.5, leftLowerArmLength+1.0, 2.5);

  var weightLeftLowerArm = new Float32Array([
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, //front
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, 
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8, 				
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8, 
	                                            
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, //right
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, 
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8, 				
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8, 
	                                            
	0.0,1.0,	0.0,1.0,	0.0,1.0,	0.0,1.0, // up			
    0.0,1.0,	0.0,1.0,	0.0,1.0,	0.0,1.0,
    0.0,1.0,	0.0,1.0,	0.0,1.0,	0.0,1.0,
	0.0,1.0,	0.0,1.0,	0.0,1.0,	0.0,1.0,
                                                
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, // left
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9,
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8,				
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8,
	                                            
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8, // down
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8, 
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8, 
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8, 
                                                
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9, // back
	0.0,1.0,	0.0,1.0,	0.1,0.9,	0.1,0.9,
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8,				
	0.1,0.9,	0.1,0.9,	0.2,0.8,	0.2,0.8,
  ]);  
  
  g_BoneMatrix4 = popMatrix();
  
  //4 rightUpperArm
  var rightUpperArmLength = torsoHeight/3;
  g_BoneMatrix4.translate(torsoWidth/2, torsoHeight-2.0, 0.0);
  g_BoneMatrix4.rotate(g_rightUpperArmAnglez, 0.0, 0.0, 1.0);
  g_BoneMatrix4.rotate(g_rightUpperArmAnglex, 1.0, 0.0, 0.0);  // Rotate around the x-axis (perchè è come se fosse verticale anche se è stato prima ruotato lungo z)  

  var weightRightUpperArm = weightNeck;  
  
  //5 rightLowerArm
  var rightLowerArmLength = torsoHeight/3;
  g_BoneMatrix5.set(g_BoneMatrix4); 

  g_BoneMatrix4.scale(3.0, rightUpperArmLength, 3.0);
  
  g_BoneMatrix5.translate(0.0, rightUpperArmLength, 0.0);       
  g_BoneMatrix5.rotate(g_rightLowerArmAngle, 0.0, 0.0, 1.0);  // Rotate around the z-axis
  g_BoneMatrix5.scale(2.5, rightLowerArmLength+1.0, 2.5);  

  var weightRightLowerArm = weightLeftLowerArm;
  
  g_BoneMatrix6 = popMatrix();
 
  //6 leftUpperLeg
  var leftUpperLegLength = torsoHeight/2;
  g_BoneMatrix6.translate(-(torsoWidth/2)+leftUpperLegLength/2, 0.0, 0.0);
  g_BoneMatrix6.rotate(g_leftUpperLegAngle, 0.0, 0.0, 1.0);  // Rotate around the y-axis  
  
  var weightLeftUpperLeg = weightNeck;     
  
  //7 leftLowerLeg
  var leftLowerLegLength = torsoHeight/2;
  g_BoneMatrix7.set(g_BoneMatrix6);

  g_BoneMatrix6.scale(3.0, leftUpperLegLength, 3.0);
  
  g_BoneMatrix7.translate(0.0, leftUpperLegLength, 0.0); 
  g_BoneMatrix7.rotate(g_leftLowerLegAngle, 1.0, 0.0, 0.0);  // Rotate around the z-axis
  g_BoneMatrix7.scale(2.5, leftLowerLegLength+1.0, 2.5);

  var weightLeftLowerLeg = weightLeftLowerArm;  
  
  g_BoneMatrix8 = popMatrix();
 
  //8 rightUpperLeg
  var rightUpperLegLength = torsoHeight/2;
  g_BoneMatrix8.translate((torsoWidth/2)-rightUpperLegLength/2, 0.0, 0.0);
  g_BoneMatrix8.rotate(g_rightUpperLegAngle, 0.0, 0.0, 1.0);  // Rotate around the y-axis

  var weightRightUpperLeg = weightNeck;  
  
  //9 rightLowerLeg
  var rightLowerLegLength = torsoHeight/2;
  g_BoneMatrix9.set(g_BoneMatrix8);

  g_BoneMatrix8.scale(3.0, rightUpperLegLength, 3.0);
  
  g_BoneMatrix9.translate(0.0, rightUpperLegLength, 0.0); 
  g_BoneMatrix9.rotate(g_rightLowerLegAngle, 1.0, 0.0, 0.0);  // Rotate around the z-axis
  g_BoneMatrix9.scale(2.5, rightLowerLegLength+1.0, 2.5);
 
  var weightRightLowerLeg = weightLeftLowerArm; 
	
  var colors = new Float32Array([     // Colors
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, //front
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, //right
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // up
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // left
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // down
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // back
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
	]);	

  
  if (!initArrayBuffer(gl, 'a_Color', colors, gl.FLOAT, 3)) return -1;
  
    var textureCoords = new Float32Array([   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // front 
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  

	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // right
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // up 
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // left
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // down
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5, 
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0, 
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0, 
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // back
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,      
	]);	  
	
  if (!initArrayBuffer(gl, 'a_TexCoord', textureCoords, gl.FLOAT, 2)) return -1;  	
  
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix0, g_BoneMatrix0, weightTorso, texture);  
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix1, g_BoneMatrix10, weightNeck, texture);
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix2, g_BoneMatrix3, weightLeftUpperArm, texture); 
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix2, g_BoneMatrix3, weightLeftLowerArm, texture); 
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix4, g_BoneMatrix5, weightRightUpperArm, texture);
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix4, g_BoneMatrix5, weightRightLowerArm, texture);
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix6, g_BoneMatrix7, weightLeftUpperLeg, texture); 
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix6, g_BoneMatrix7, weightLeftLowerLeg, texture); 
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix8, g_BoneMatrix9, weightRightUpperLeg, texture);
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix8, g_BoneMatrix9, weightRightLowerLeg, texture); 
}

function draw2(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture) {
  console.log('draw2 head');
  
  //Draw head
  var weightHead = new Float32Array([
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, //front
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, 
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2, 		
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2, 
	                                            
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, //right
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, 
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2, 		
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2, 
	                                            
    0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8, // up
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8,
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8,
	0.2,0.8,	0.2,0.8,	0.2,0.8,	0.2,0.8,
                                                
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, // left
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1,
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2,		
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2,
	                                            
	0.8,0.2,	0.8,0.2,	0.8,0.2,	0.8,0.2, // down
	0.8,0.2,	0.8,0.2,	0.8,0.2,	0.8,0.2, 
	0.8,0.2,	0.8,0.2,	0.8,0.2,	0.8,0.2, 
	0.8,0.2,	0.8,0.2,	0.8,0.2,	0.8,0.2, 
                                                
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1, // back
	1.0,0.0,	1.0,0.0,	0.9,0.1,	0.9,0.1,
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2,		
	0.9,0.1,	0.9,0.1,	0.8,0.2,	0.8,0.2,
  ]);  
  
  var colors = new Float32Array([     // Colors
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, //front
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, //right
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // up
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // left
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,		
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // down
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, 
                                                                  
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0, // back
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,  1.0, 1.0, 1.0,
	]);	

  
  if (!initArrayBuffer(gl, 'a_Color', colors, gl.FLOAT, 3)) return -1;  
  
    var textureCoords = new Float32Array([   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,    1.0, 0.5,    //front
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,    0.5, 0.5,    
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,    0.5, 0.0,    		
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,    1.0, 0.0,    
                                                       
	  0.9, 0.9,   0.89, 0.9,  0.89, 0.89,  0.9, 0.89,   //right
	  0.89, 0.9,  0.88, 0.9,  0.88, 0.89,  0.89, 0.89,   
	  0.89, 0.89, 0.88, 0.89, 0.88, 0.88,  0.89, 0.88,  		 
	  0.9, 0.89,  0.89, 0.89, 0.89, 0.88,  0.9, 0.88,   
	                                                   
	  0.9, 0.9,   0.89, 0.9,  0.89, 0.89,  0.9, 0.89,   // up
	  0.89, 0.9,  0.88, 0.9,  0.88, 0.89,  0.89, 0.89,  
	  0.89, 0.89, 0.88, 0.89, 0.88, 0.88,  0.89, 0.88,  
	  0.9, 0.89,  0.89, 0.89, 0.89, 0.88,  0.9, 0.88,  
	                                                   
	  0.9, 0.9,   0.89, 0.9,  0.89, 0.89,  0.9, 0.89,   // left
	  0.89, 0.9,  0.88, 0.9,  0.88, 0.89,  0.89, 0.89,  
	  0.89, 0.89, 0.88, 0.89, 0.88, 0.88,  0.89, 0.88, 		 
	  0.9, 0.89,  0.89, 0.89, 0.89, 0.88,  0.9, 0.88,  
                                                       
	  0.9, 0.9,   0.89, 0.9,  0.89, 0.89,  0.9, 0.89,   // down
	  0.89, 0.9,  0.88, 0.9,  0.88, 0.89,  0.89, 0.89,   
	  0.89, 0.89, 0.88, 0.89, 0.88, 0.88,  0.89, 0.88,   
	  0.9, 0.89,  0.89, 0.89, 0.89, 0.88,  0.9, 0.88,   
                                                       
	  0.9, 0.9,   0.89, 0.9,  0.89, 0.89,  0.9, 0.89,   // back
	  0.89, 0.9,  0.88, 0.9,  0.88, 0.89,  0.89, 0.89,  
	  0.89, 0.89, 0.88, 0.89, 0.88, 0.88,  0.89, 0.88,  
	  0.9, 0.89,  0.89, 0.89, 0.89, 0.88,  0.9, 0.88,	  
	]);	  
	
  if (!initArrayBuffer(gl, 'a_TexCoord', textureCoords, gl.FLOAT, 2)) return -1;    
 
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix10, g_BoneMatrix1, weightHead, texture);  
}

function draw3(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, texture) { 
 /////////////////////////FLOOR////////////////////////////
  console.log('draw3 floor');

  g_BoneMatrix11.setTranslate(0.0, -6.0, 0.0);
  g_BoneMatrix11.rotate(g_torsoAngle, 0.0, 1.0, 0.0);  // Rotate around the y-axis rotate(ANGLE,x,y,z)
  
  g_BoneMatrix11.translate(0.0, -12.0, 0.0);
  g_BoneMatrix11.rotate(180.0, 0.0, 0.0, 1.0);  // Rotate around the z-axis    
  g_BoneMatrix11.scale(80.0, 0.1, 80.0);
  
    var weightFloor = new Float32Array([
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, //front	
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 							
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	                                             
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, //right
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 			
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	                                             
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, // up					
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,
	                                             
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, // left	
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,							
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	
	                                             
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, // down
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 	
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, 
	                                             
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0, // back					
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	
    0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,		
	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	0.0, 1.0,	
  ]); 
  
    colors = new Float32Array([     // green
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, //front
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 			
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
                                                                  
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, //right
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 			
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
                                                                  
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, // up		
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,	
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,
                                                                  
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, // left
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,			
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,	
                                                                  
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, // down
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 	
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, 
                                                                  
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1, // back
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,	
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,		
    0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,  0.0, 0.5, 0.1,	
	]);

  
  if (!initArrayBuffer(gl, 'a_Color', colors, gl.FLOAT, 3)) return -1;  
  
    var textureCoords = new Float32Array([   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // front 
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  

	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // right
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // up 
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // left
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,  
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // down
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5, 
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0, 
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0, 
                                                   
	  1.0, 1.0,   0.5, 1.0,   0.5, 0.5,   1.0, 0.5, // back
	  0.5, 1.0,   0.0, 1.0,   0.0, 0.5,   0.5, 0.5,  
	  0.5, 0.5,   0.0, 0.5,   0.0, 0.0,   0.5, 0.0,  
	  1.0, 0.5,   0.5, 0.5,   0.5, 0.0,   1.0, 0.0,      
	]);	  
	
  if (!initArrayBuffer(gl, 'a_TexCoord', textureCoords, gl.FLOAT, 2)) return -1;    
  
  drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix8, g_BoneMatrix11, weightFloor, texture); // Draw9  
}

var g_matrixStack = []; // Array for storing a matrix
function pushMatrix(m) { // Store the specified matrix to the array
  var m2 = new Matrix4(m);
  g_matrixStack.push(m2);
}

function popMatrix() { // Retrieve the matrix from the array
  return g_matrixStack.pop();
}

var g_normalMatrix = new Matrix4(), g_VpMatrix = new Matrix4();  // Coordinate transformation matrix for normals

// Draw rectangular solid
function drawBox(gl, n, viewProjMatrix, u_VpMatrix, u_NormalMatrix, u_BoneMatrix0, u_BoneMatrix1, g_BoneMatrix0, g_BoneMatrix1, weights, texture) {
    if (!initArrayBuffer(gl, 'a_Weight', weights, gl.FLOAT, 2)) return -1;

	// Bind texture object to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
	
    // Calculate the view project matrix and pass it to u_VpMatrix
    g_VpMatrix.set(viewProjMatrix);
    gl.uniformMatrix4fv(u_VpMatrix, false, g_VpMatrix.elements);//gl.uniformMatrix4fv (location, transpose, array)
	
    gl.uniformMatrix4fv(u_BoneMatrix0, false, g_BoneMatrix0.elements);	
    gl.uniformMatrix4fv(u_BoneMatrix1, false, g_BoneMatrix1.elements);	
	
    // Calculate the normal transformation matrix and pass it to u_NormalMatrix
    g_normalMatrix.setInverseOf(g_BoneMatrix0);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, g_normalMatrix.elements);
    // Draw
    gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);//gl.drawElements(mode, count, type, offset) pag.278
}

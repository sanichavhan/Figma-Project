const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const layerList = document.querySelector('.layer-list');
const popup = document.getElementById("popup");
const square = document.getElementById("square");
const imageInput = document.getElementById('imageInput');

let objects = JSON.parse(localStorage.getItem('figma_data')) || [];
let selectedObjects = []; 
let undoStack = []; 
let isDrawing = false;
let isDragging = false;
let currentTool = 'rect'; 
let startX, startY;
let dragOffsets = [];
let activeTextInput = null;

const fontSizeSelect = document.getElementById("fontSize");
if (fontSizeSelect && fontSizeSelect.options.length === 0) {
    for (let i = 1; i <= 120; i++) {
        const opt = document.createElement("option");
        opt.value = i; opt.textContent = i;
        fontSizeSelect.appendChild(opt);
    }
    fontSizeSelect.value = 18;
}

function init() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    objects.forEach(obj => {
        if(obj.type === 'image' && obj.src) {
            obj.imgEl = new Image();
            obj.imgEl.src = obj.src;
            obj.imgEl.onload = () => render();
        }
    });
    render();
    updateLayers();
}
window.addEventListener('load', init);

function saveState() {
    undoStack.push(JSON.stringify(objects));
    if (undoStack.length > 30) undoStack.shift(); 
}

function saveAndRefresh() {
    localStorage.setItem('figma_data', JSON.stringify(objects));
    updateLayers();
    render();
}

window.addEventListener('keydown', (e) => {

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || activeTextInput) return;

    if (e.ctrlKey && e.key === 'z') {
        if (undoStack.length > 0) {
            objects = JSON.parse(undoStack.pop());
            selectedObjects = [];
            saveAndRefresh();
        }
        return;
    }

    if (e.key === 'Delete' || (e.key === 'Backspace' && selectedObjects.length === 1 && !selectedObjects[0].label)) {
        if (selectedObjects.length > 0) {
            saveState();
            objects = objects.filter(obj => !selectedObjects.includes(obj));
            selectedObjects = [];
            saveAndRefresh();
        }
        return;
    }
    
    if (selectedObjects.length === 1) {
        let obj = selectedObjects[0];
    
        if (['rect', 'circle', 'triangle'].includes(obj.type)) {
            if (e.key.length === 1) { 
                obj.label = (obj.label || "") + e.key;
                saveAndRefresh();
            } else if (e.key === 'Backspace' && obj.label) { 
                obj.label = obj.label.slice(0, -1);
                saveAndRefresh();
            }
        }
    }
});

function getMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function isInside(x, y, obj) {
    const left = obj.w < 0 ? obj.x + obj.w : obj.x;
    const top = obj.h < 0 ? obj.y + obj.h : obj.y;
    const width = Math.abs(obj.w || 100);
    const height = Math.abs(obj.h || 30);

    if (obj.type === 'rect' || obj.type === 'image' || obj.type === 'text' || obj.type === 'triangle') {
        return x >= left && x <= left + width && y >= top && y <= top + height;
    }
    if (obj.type === 'circle') {
        const dx = x - (obj.x + obj.w/2);
        const dy = y - (obj.y + obj.h/2);
        return (dx*dx)/(obj.w*obj.w/4) + (dy*dy)/(obj.h*obj.h/4) <= 1;
    }
    return false;
}

function selectLayer(index) {
    const actualIndex = objects.length - 1 - index;
    if (objects[actualIndex]) {
        selectedObjects = [objects[actualIndex]];
        syncSidebar(objects[actualIndex]);
        saveAndRefresh();
    }
}

let isResizing = false;
let currentHandle = null; 
const HANDLE_SIZE = 8;

function getHandleAt(m, obj) {
    if (!selectedObjects.includes(obj)) return null;

    const left = obj.x;
    const right = obj.x + obj.w;
    const top = obj.y;
    const bottom = obj.y + obj.h;
    const midX = obj.x + obj.w / 2;

    if (obj.type === 'triangle') {
        
        if (Math.hypot(m.x - midX, m.y - top) < HANDLE_SIZE) return 'tc';
        if (Math.hypot(m.x - left, m.y - bottom) < HANDLE_SIZE) return 'bl';
        if (Math.hypot(m.x - right, m.y - bottom) < HANDLE_SIZE) return 'br';
    } else {
    
        if (Math.hypot(m.x - left, m.y - top) < HANDLE_SIZE) return 'tl';
        if (Math.hypot(m.x - right, m.y - top) < HANDLE_SIZE) return 'tr';
        if (Math.hypot(m.x - left, m.y - bottom) < HANDLE_SIZE) return 'bl';
        if (Math.hypot(m.x - right, m.y - bottom) < HANDLE_SIZE) return 'br';
    }
    return null;
}

canvas.addEventListener('mousedown', (e) => {
    const m = getMouse(e);
    
    if (selectedObjects.length === 1) {
        const handle = getHandleAt(m, selectedObjects[0]);
        if (handle) {
            saveState();
            isResizing = true;
            currentHandle = handle;
            return;
        }
    }

    const hit = [...objects].reverse().find(obj => isInside(m.x, m.y, obj));
    if (hit && currentTool !== 'sketch') {
        saveState();
        selectedObjects = e.shiftKey ? [...selectedObjects, hit] : [hit];
        isDragging = true;
        dragOffsets = selectedObjects.map(obj => ({ dx: m.x - obj.x, dy: m.y - obj.y }));
        syncSidebar(hit);
    } else {
        saveState();
        selectedObjects = [];
        isDrawing = true;
        startX = m.x; startY = m.y;
        const newObj = {
            id: Date.now(), type: currentTool, x: startX, y: startY, w: 1, h: 1, 
            fill: "transparent", stroke: document.getElementById('strokePicker').value || "#ffffff",
            label: ""
        };
        objects.push(newObj);
        selectedObjects = [newObj];
    }
    render();
});

canvas.addEventListener('mousemove', (e) => {
    const m = getMouse(e);
    const obj = selectedObjects[0];

    if (isResizing && obj) {
        
        if (currentHandle === 'br') { obj.w = m.x - obj.x; obj.h = m.y - obj.y; }
        else if (currentHandle === 'bl') { const oldR = obj.x + obj.w; obj.x = m.x; obj.w = oldR - m.x; obj.h = m.y - obj.y; }
        else if (currentHandle === 'tr') { const oldB = obj.y + obj.h; obj.y = m.y; obj.h = oldB - m.y; obj.w = m.x - obj.x; }
        else if (currentHandle === 'tl') { 
            const oldR = obj.x + obj.w; const oldB = obj.y + obj.h;
            obj.x = m.x; obj.y = m.y; obj.w = oldR - m.x; obj.h = oldB - m.y; 
        }
        else if (currentHandle === 'tc') { const oldB = obj.y + obj.h; obj.y = m.y; obj.h = oldB - m.y; }
    } 
    else if (isDragging) {
        selectedObjects.forEach((o, i) => { o.x = m.x - dragOffsets[i].dx; o.y = m.y - dragOffsets[i].dy; });
    } 
    else if (isDrawing) {
        obj.w = m.x - startX; obj.h = m.y - startY;
    }

    if (selectedObjects.length === 1) {
        canvas.style.cursor = getHandleAt(m, obj) ? 'nwse-resize' : 'default';
    }

    if (isDragging || isDrawing || isResizing) render();
});

canvas.addEventListener('mouseup', () => {
    isDrawing = isDragging = isResizing = false;
    currentHandle = null;
    saveAndRefresh();
});

function drawHandles(obj) {
    ctx.fillStyle = "#3b82f6";
    ctx.setLineDash([]);
    const handles = obj.type === 'triangle' ? 
        [[obj.x + obj.w / 2, obj.y], [obj.x, obj.y + obj.h], [obj.x + obj.w, obj.y + obj.h]] :
        [[obj.x, obj.y], [obj.x + obj.w, obj.y], [obj.x, obj.y + obj.h], [obj.x + obj.w, obj.y + obj.h]];

    handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });
}

const updateProp = (prop, val) => {
    selectedObjects.forEach(obj => { 
        obj[prop] = val; 
        
        if (prop === 'stroke' && !obj.labelColor) {
            obj.labelColor = val;
        }
    });
    saveAndRefresh();
};


document.getElementById('widthInput').addEventListener('input', e => updateProp('w', parseInt(e.target.value)));
document.getElementById('heightInput').addEventListener('input', e => updateProp('h', parseInt(e.target.value)));


document.getElementById('colorPicker').addEventListener('input', e => {
    document.getElementById('colorHex').value = e.target.value;
    updateProp('fill', e.target.value); 
});

document.getElementById('strokePicker').addEventListener('input', e => {
    document.getElementById('strokeHex').value = e.target.value;
    updateProp('stroke', e.target.value); 
    updateProp('labelColor', e.target.value); 
});

document.getElementById('fontFamily').addEventListener('change', e => updateProp('fontFamily', e.target.value));
document.getElementById('fontSize').addEventListener('change', e => updateProp('fontSize', parseInt(e.target.value)));
document.getElementById('fontStyle').addEventListener('change', e => updateProp('fontStyle', e.target.value));

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(obj => {
        ctx.save();
        
        
        ctx.strokeStyle = obj.stroke || "#ffffff";
        ctx.lineWidth = 2;
        if (selectedObjects.includes(obj)) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = "#3b82f6";
        }

        ctx.fillStyle = (obj.fill === "transparent") ? "rgba(0,0,0,0)" : obj.fill;

        if (obj.type === 'rect') {
            if (obj.fill !== "transparent") ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        } else if (obj.type === 'circle') {
            ctx.beginPath();
            ctx.ellipse(obj.x + obj.w/2, obj.y + obj.h/2, Math.abs(obj.w/2), Math.abs(obj.h/2), 0, 0, Math.PI*2);
            if (obj.fill !== "transparent") ctx.fill();
            ctx.stroke();
        } else if (obj.type === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(obj.x + obj.w / 2, obj.y);
            ctx.lineTo(obj.x, obj.y + obj.h);
            ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
            ctx.closePath();
            if (obj.fill !== "transparent") ctx.fill();
            ctx.stroke();
        }
        else if (obj.type === 'image' && obj.imgEl) {
            ctx.drawImage(obj.imgEl, obj.x, obj.y, obj.w, obj.h);
        }
        else if (obj.type === 'text') {
            
            const weight = (obj.fontStyle === 'bold' || obj.fontStyle === '600') ? 'bold ' : '';
            const style = (obj.fontStyle === 'italic') ? 'italic ' : '';
            ctx.font = `${style}${weight}${obj.fontSize}px ${obj.fontFamily}`;
            ctx.fillStyle = (obj.fill === "transparent") ? obj.stroke : obj.fill; 
            ctx.fillText(obj.text, obj.x, obj.y);
        }

        if (obj.label && ['rect', 'circle', 'triangle'].includes(obj.type)) {
            ctx.setLineDash([]); 
            ctx.fillStyle = obj.labelColor || obj.stroke || "#ffffff"; 
            
           
            const weight = (obj.fontStyle === 'bold' || obj.fontStyle === '600') ? 'bold ' : '';
            const style = (obj.fontStyle === 'italic') ? 'italic ' : '';
            ctx.font = `${style}${weight}${obj.fontSize}px ${obj.fontFamily}`;
            
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            let cX = obj.x + obj.w / 2;
            let cY = obj.y + obj.h / 2;
            if (obj.type === 'triangle') cY += obj.h / 6;
            
            ctx.fillText(obj.label, cX, cY);
        }
        ctx.restore();
    });
}


imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
            saveState();
            const newImgObj = {
                id: Date.now(),
                type: 'image',
                x: 100, y: 100, 
                w: 500, h: 500, 
                src: img.src,
                imgEl: img,
                fill: 'transparent',
                stroke: 'transparent',
                label: ""
            };
            objects.push(newImgObj);
            selectedObjects = [newImgObj]; 
            saveAndRefresh();
        };
    };
    reader.readAsDataURL(file);
});

square.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.classList.toggle("active");
    const r = square.getBoundingClientRect();
    popup.style.left = (r.left - 35 ) + "px";
    popup.style.top = (r.bottom - 170) + "px";
});

document.querySelectorAll('.tool').forEach(t => {
    t.addEventListener('click', () => {
        currentTool = t.dataset.tool;
        if(currentTool === 'image') imageInput.click();
        popup.classList.remove('active');
    });
});

function updateLayers() {
    layerList.innerHTML = objects.map((obj, i) => `
        <div class="layer-item" onclick="selectLayer(${objects.length - 1 - i})" style="padding:15px; border-bottom:1px solid #333; cursor:pointer; color: ${selectedObjects.includes(obj) ? '#3b82f6' : '#8dc9e5'}; font-size:12px">
            LAYER ${i+1} (${obj.type.toUpperCase()})
        </div>
    `).reverse().join('');
}

function syncSidebar(obj) {
    document.getElementById('widthInput').value = Math.round(obj.w);
    document.getElementById('heightInput').value = Math.round(obj.h);
}

function changeTheme() {
    var themeBtn = document.querySelector('.theme');
    var root = document.documentElement;
    const themes = [
        { pri: '#F8F4E1', sec: '#222831', tri1: '#948979', tri2: '#393E46' }, 
        { pri: '#F1EFEC', sec: '#030303', tri1: '#D4C9BE', tri2: '#123458' }, 
        { pri: '#F8F4E1', sec: '#381c0a', tri1: '#FEBA17', tri2: '#74512D' },
        { pri: '#0F172A', sec: '#5e7388', tri1: '#38BDF8', tri2: '#1E293B' }, 
        { pri: '#FDFCF0', sec: '#282828', tri1: '#EBDBB2', tri2: '#A89984' }, 
        { pri: '#1E1E2E', sec: '#CDD6F4', tri1: '#89B4FA', tri2: '#313244' }, 
        { pri: '#F3F4F6', sec: '#111827', tri1: '#60A5FA', tri2: '#D1D5DB' }, 
        { pri: '#2E3440', sec: '#6d63a3', tri1: '#88C0D0', tri2: '#4C566A' }, 
        { pri: '#1A1A1A', sec: '#463a3a', tri1: '#FFD700', tri2: '#333333' }, 
        { pri: '#FAF9F6', sec: '#4A4A4A', tri1: '#C2B280', tri2: '#E1D9D1' }, 
        { pri: '#0D0D0D', sec: '#e9da87a9', tri1: '#FF0055', tri2: '#1A1A1A' }, 
        { pri: '#FFF5F5', sec: '#742A2A', tri1: '#FEB2B2', tri2: '#F56565' }, 
        { pri: '#E0F2F1', sec: '#004D40', tri1: '#4DB6AC', tri2: '#B2DFDB' }, 
        { pri: '#282C34', sec: '#ABB2BF', tri1: '#61AFEF', tri2: '#21252B' }, 
        { pri: '#F0EAD6', sec: '#5C4033', tri1: '#A67B5B', tri2: '#ECB176' }, 
        { pri: '#E6E9EF', sec: '#4C4F69', tri1: '#7287FD', tri2: '#DCE0E8' }, 
        { pri: '#24292E', sec: '#84bcf5', tri1: '#0366D6', tri2: '#F6F8FA' }, 
        { pri: '#121212', sec: '#BB86FC', tri1: '#03DAC6', tri2: '#1F1F1F' }, 
        { pri: '#FFFFFF', sec: '#1A1A1B', tri1: '#0079D3', tri2: '#3d464f' }, 
        { pri: '#002B36', sec: '#839496', tri1: '#268BD2', tri2: '#073642' }  
    ];
    let flag = 0;
    themeBtn.addEventListener('click', () => {
        const d = themes[flag];
        root.style.setProperty('--pri', d.pri); root.style.setProperty('--sec', d.sec);
        root.style.setProperty('--tri1', d.tri1); root.style.setProperty('--tri2', d.tri2);
        flag = (flag + 1) % themes.length;
    });
}
changeTheme();

document.querySelector('.json').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects, null, 2));
    const downloadAnchorNode = document.createElement('a');
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "figma_pro_design.json");
    document.body.appendChild(downloadAnchorNode);
    
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

document.querySelector('.html').addEventListener('click', () => {
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Figma Pro Export</title>
        <style>
            body { margin: 0; background: #f4f4f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
            .canvas-preview { 
                position: relative; 
                width: ${canvas.width}px; 
                height: ${canvas.height}px; 
                background: white; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .obj { position: absolute; box-sizing: border-box; }
        </style>
    </head>
    <body>
        <div class="canvas-preview">`;

    objects.forEach(obj => {
        const left = obj.w < 0 ? obj.x + obj.w : obj.x;
        const top = obj.h < 0 ? obj.y + obj.h : obj.y;
        const width = Math.abs(obj.w);
        const height = Math.abs(obj.h);
        const fill = obj.fill === "transparent" ? "transparent" : obj.fill;

        if (obj.type === 'rect') {
            htmlContent += `
            <div class="obj" style="left:${left}px; top:${top}px; width:${width}px; height:${height}px; background:${fill}; border:2px solid ${obj.stroke}; display:flex; align-items:center; justify-content:center; color:${obj.stroke}; font-weight:bold;">
                ${obj.label || ''}
            </div>`;
        } else if (obj.type === 'circle') {
            htmlContent += `
            <div class="obj" style="left:${left}px; top:${top}px; width:${width}px; height:${height}px; background:${fill}; border:2px solid ${obj.stroke}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:${obj.stroke}; font-weight:bold;">
                ${obj.label || ''}
            </div>`;
        } else if (obj.type === 'text') {
            htmlContent += `
            <div class="obj" style="left:${obj.x}px; top:${obj.y}px; color:${obj.stroke}; font-size:${obj.fontSize}px; font-family:${obj.fontFamily}; white-space:nowrap;">
                ${obj.text}
            </div>`;
        }
    });
    htmlContent += `</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "design_preview.html";
    link.click();
});
document.querySelector('.png').addEventListener('click', () => {
    const link = document.createElement('a'); 
    link.download = 'figma_pro_design.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
    link.remove();
});
document.querySelector('.pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
    });
    const canvasImage = canvas.toDataURL("image/png");
    doc.addImage(canvasImage, 'PNG', 0, 0, canvas.width, canvas.height);
    doc.save('figma_pro_export.pdf');
});
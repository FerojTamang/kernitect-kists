import { expect, test, type Page } from '@playwright/test';

const password=process.env.KISTS_DEMO_PASSWORD!;
async function signIn(page:Page){await page.goto('/');await page.getByLabel('Email address',{exact:true}).fill('kists.administrator@example.invalid');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/admin\/dashboard$/)}

test('administrator training library opens module management and persists a question',async({page})=>{
  await signIn(page);
  const module={id:1,title:'Manual Handling',slug:'manual-handling',description:'Safe manual handling techniques.',isActive:true,learningSectionCount:5,scenarioCount:1,hazardCount:5,assessmentCount:1,questionCount:1,passPercentage:75,activeAssignmentCount:1};
  const questions=[{id:10,questionText:'What should you do first?',sequenceOrder:1,options:[{id:1,optionText:'Assess the load',isCorrect:true,sequenceOrder:1},{id:2,optionText:'Lift immediately',isCorrect:false,sequenceOrder:2}]}];
  await page.route('**/api/admin/training-content**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname;
    if(request.method()==='POST'&&path.endsWith('/assessments/5/questions')){const body=request.postDataJSON() as {questionText:string;options:Array<{optionText:string;isCorrect:boolean}>};questions.push({id:11,questionText:body.questionText,sequenceOrder:2,options:body.options.map((option,index)=>({id:20+index,...option,sequenceOrder:index+1}))});module.questionCount=questions.length;await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:11})});return}
    if(path.endsWith('/training-content/1')){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...module,learningSections:[{id:1,title:'Introduction',contentType:'text',sequenceOrder:1,isActive:true}],scenarios:[{id:2,title:'Warehouse Manual Handling',description:'Find the hazards.',isActive:true,sequenceOrder:1,hazardCount:5}],assessments:[{id:5,title:'Manual Handling Final Assessment',description:'',passPercentage:75,isActive:true,hasAttempts:false,questions}]})});return}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({summary:{totalModules:1,activeModules:1,draftModules:0,assessmentQuestions:questions.length},modules:[module]})});
  });
  await page.goto('/admin/training');
  await expect(page.getByRole('heading',{name:'Training content'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Manual Handling',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Manage'}).click();
  await expect(page).toHaveURL(/\/admin\/training\/1$/);
  await page.getByRole('button',{name:'Assessment'}).click();
  await expect(page.getByText('Pass mark 75% · 1 questions')).toBeVisible();
  await page.getByRole('button',{name:'+ Add question'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Question text').fill('How should a load be prepared?');
  await dialog.getByLabel('Answer option 1').fill('Assess and plan');
  await dialog.getByLabel('Answer option 2').fill('Move without checking');
  await dialog.getByRole('button',{name:'Save question'}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('How should a load be prepared?')).toBeVisible();
  for(const width of [1024,1366,1440,1536,1920]){await page.setViewportSize({width,height:900});await page.goto('/admin/training');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)}
});
